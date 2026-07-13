$ErrorActionPreference = "Stop"

$EnvFile = Join-Path $PSScriptRoot "chatllm.env"
$AbacusPackage = "@abacus-ai/cli"
$NodeWingetIds = @("OpenJS.NodeJS.LTS", "OpenJS.NodeJS")

function Write-SetupLog {
  param([string]$Message)
  [Console]::Error.WriteLine("[chatllm-call setup] $Message")
}

function Import-EnvFile {
  param([string]$Path)

  $values = [ordered]@{}
  if (-not (Test-Path -LiteralPath $Path)) { return $values }

  foreach ($line in Get-Content -LiteralPath $Path) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith("#")) { continue }
    $parts = $trimmed -split "=", 2
    if ($parts.Count -ne 2) { continue }
    $name = $parts[0].Trim()
    $value = $parts[1].Trim().Trim('"').Trim("'")
    if ($name) {
      $values[$name] = $value
      [Environment]::SetEnvironmentVariable($name, $value, "Process")
    }
  }

  return $values
}

function Set-EnvFileValue {
  param(
    [string]$Path,
    [string]$Name,
    [string]$Value
  )

  $lines = New-Object System.Collections.Generic.List[string]
  $updated = $false

  if (Test-Path -LiteralPath $Path) {
    foreach ($line in Get-Content -LiteralPath $Path) {
      if ($line -match "^\s*$([regex]::Escape($Name))\s*=") {
        $lines.Add("$Name=$Value")
        $updated = $true
      } else {
        $lines.Add($line)
      }
    }
  }

  if (-not $updated) {
    if ($lines.Count -gt 0 -and $lines[$lines.Count - 1].Trim()) {
      $lines.Add("")
    }
    $lines.Add("$Name=$Value")
  }

  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, ($lines.ToArray() -join "`n") + "`n", $utf8NoBom)
  [Environment]::SetEnvironmentVariable($Name, $Value, "Process")
}

function Test-ExistingPath {
  param([string]$Path)

  if (-not $Path) { return $false }
  try {
    return (Test-Path -LiteralPath ([Environment]::ExpandEnvironmentVariables($Path)))
  } catch {
    return $false
  }
}

function Resolve-ExistingPath {
  param([string]$Path)

  $expanded = [Environment]::ExpandEnvironmentVariables($Path)
  if (Test-ExistingPath -Path $expanded) {
    return (Resolve-Path -LiteralPath $expanded).Path
  }
  return ""
}

function Invoke-Native {
  param(
    [string]$FilePath,
    [string[]]$Arguments
  )

  $output = @()
  $exitCode = 0

  try {
    $output = @(& $FilePath @Arguments 2>&1)
    $exitCode = $LASTEXITCODE
  } catch {
    $output = @($_.Exception.Message)
    if ($null -ne $LASTEXITCODE) {
      $exitCode = $LASTEXITCODE
    } else {
      $exitCode = 1
    }
  }

  [pscustomobject]@{
    exit_code = $exitCode
    output = (($output | ForEach-Object { [string]$_ }) -join "`n")
  }
}

function Find-CommandPath {
  param(
    [string]$CommandName,
    [string[]]$PreferredNames = @()
  )

  $whereOutput = @()
  try {
    $whereOutput = @(where.exe $CommandName 2>$null)
  } catch {
    $whereOutput = @()
  }

  $candidates = New-Object System.Collections.Generic.List[string]
  foreach ($line in $whereOutput) {
    $candidate = ([string]$line).Trim()
    if ($candidate) { $candidates.Add($candidate) }
  }

  foreach ($name in @($PreferredNames + @($CommandName))) {
    $cmd = Get-Command $name -ErrorAction SilentlyContinue
    if ($cmd) { $candidates.Add($cmd.Source) }
  }

  foreach ($candidate in $candidates) {
    $resolved = Resolve-ExistingPath -Path $candidate
    if ($resolved) { return $resolved }
  }

  return ""
}

function Get-NpmPath {
  $npm = Find-CommandPath -CommandName "npm" -PreferredNames @("npm.cmd", "npm.exe", "npm")
  if ($npm) { return $npm }

  $common = @(
    "$env:ProgramFiles\nodejs\npm.cmd",
    "${env:ProgramFiles(x86)}\nodejs\npm.cmd",
    "D:\Program Files\nodejs\npm.cmd"
  )

  foreach ($candidate in $common) {
    $resolved = Resolve-ExistingPath -Path $candidate
    if ($resolved) { return $resolved }
  }

  return ""
}

function Install-NodeWithWinget {
  $winget = Find-CommandPath -CommandName "winget" -PreferredNames @("winget.exe", "winget")
  if (-not $winget) {
    throw "npm is missing and winget was not found. Install Node.js LTS, then rerun this script."
  }

  foreach ($id in $NodeWingetIds) {
    Write-SetupLog "Installing Node.js/npm with winget package $id"
    $result = Invoke-Native -FilePath $winget -Arguments @(
      "install",
      "--id", $id,
      "--source", "winget",
      "--accept-package-agreements",
      "--accept-source-agreements"
    )

    if ($result.exit_code -eq 0) {
      $npm = Get-NpmPath
      if ($npm) { return $npm }
    }
  }

  throw "Node.js/npm installation did not complete successfully. Open a new terminal after installing Node.js and rerun this script."
}

function Ensure-Npm {
  $npm = Get-NpmPath
  if ($npm) { return $npm }
  return Install-NodeWithWinget
}

function Get-NpmGlobalBin {
  param([string]$NpmPath)

  if (-not $NpmPath) { return "" }
  $prefix = Invoke-Native -FilePath $NpmPath -Arguments @("config", "get", "prefix")
  if ($prefix.exit_code -ne 0) { return "" }
  return ($prefix.output -split "`r?`n" | Select-Object -First 1).Trim()
}

function Find-AbacusCmd {
  param([string]$NpmPath = "")

  $fromPath = Find-CommandPath -CommandName "abacusai" -PreferredNames @("abacusai.cmd", "abacusai.exe", "abacusai.ps1", "abacusai")
  if ($fromPath) { return $fromPath }

  $candidateDirs = New-Object System.Collections.Generic.List[string]
  if ($env:APPDATA) {
    $candidateDirs.Add((Join-Path $env:APPDATA "npm"))
  }

  $npmGlobalBin = Get-NpmGlobalBin -NpmPath $NpmPath
  if ($npmGlobalBin) {
    $candidateDirs.Add($npmGlobalBin)
  }

  foreach ($dir in ($candidateDirs | Select-Object -Unique)) {
    foreach ($name in @("abacusai.cmd", "abacusai.exe", "abacusai.ps1", "abacusai")) {
      $candidate = Join-Path $dir $name
      $resolved = Resolve-ExistingPath -Path $candidate
      if ($resolved) { return $resolved }
    }
  }

  return ""
}

function Install-AbacusCli {
  param([string]$NpmPath)

  Write-SetupLog "Installing Abacus AI CLI with npm package $AbacusPackage"
  $install = Invoke-Native -FilePath $NpmPath -Arguments @("install", "-g", $AbacusPackage)
  if ($install.exit_code -ne 0) {
    throw "Failed to install $AbacusPackage. $($install.output)"
  }
}

function Invoke-AbacusLogin {
  param([string]$AbacusCmd)

  Write-SetupLog "Starting Abacus.AI login. Complete the authentication flow in this terminal."
  & $AbacusCmd auth login
  $loginExit = $LASTEXITCODE
  if ($loginExit -ne 0) {
    throw "Abacus login failed or was cancelled."
  }
}

function Ensure-AbacusCmd {
  $envValues = Import-EnvFile -Path $EnvFile

  $cached = ""
  if ($envValues.Contains("ABACUSAI_CMD")) {
    $cached = Resolve-ExistingPath -Path $envValues["ABACUSAI_CMD"]
  } elseif ($env:ABACUSAI_CMD) {
    $cached = Resolve-ExistingPath -Path $env:ABACUSAI_CMD
  }

  if ($cached) {
    return $cached
  }

  Write-SetupLog "ABACUSAI_CMD is missing from chatllm.env; starting setup."
  $npm = Ensure-Npm

  $abacusCmd = Find-AbacusCmd -NpmPath $npm
  if (-not $abacusCmd) {
    Install-AbacusCli -NpmPath $npm
    $abacusCmd = Find-AbacusCmd -NpmPath $npm
  }

  if (-not $abacusCmd) {
    throw "Abacus AI CLI was installed, but abacusai.cmd could not be found. Open a new terminal and rerun this script."
  }

  Set-EnvFileValue -Path $EnvFile -Name "ABACUSAI_CMD" -Value $abacusCmd
  Write-SetupLog "Stored ABACUSAI_CMD=$abacusCmd in chatllm.env"
  Invoke-AbacusLogin -AbacusCmd $abacusCmd

  return $abacusCmd
}

$abacusCmdPath = Ensure-AbacusCmd
$abacusArgs = @($args)

& $abacusCmdPath @abacusArgs
exit $LASTEXITCODE
