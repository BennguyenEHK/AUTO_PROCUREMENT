param(
  [string]$WebAppPath,
  [switch]$SkipDependencyInstall,
  [switch]$SkipDatabasePing,
  [switch]$SkipStartupCheck
)

$ErrorActionPreference = "Stop"

function Find-CommandPath {
  param([string[]]$Names)
  foreach ($name in $Names) {
    $matches = @(& where.exe $name 2>$null)
    if ($LASTEXITCODE -eq 0 -and $matches.Count -gt 0) { return $matches[0].Trim() }
  }
  return $null
}

function Refresh-ProcessPath {
  $machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
  $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
  $env:Path = @($machinePath, $userPath, $env:Path | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }) -join ";"
}

function Ensure-NodeAndNpm {
  $nodePath = Find-CommandPath -Names @("node.exe", "node")
  $npmPath = Find-CommandPath -Names @("npm.cmd", "npm")
  if ($nodePath -and $npmPath) {
    return [pscustomobject]@{ node_path = $nodePath; npm_path = $npmPath; installation = "not_needed" }
  }

  $wingetPath = Find-CommandPath -Names @("winget.exe", "winget")
  if (-not $wingetPath) {
    throw "Node.js or npm is missing and WinGet is unavailable. Install Microsoft App Installer/WinGet, then rerun setup."
  }

  # Official WinGet package ID for the current Node.js LTS release. npm is bundled with Node.js.
  $null = & $wingetPath "install" "--id" "OpenJS.NodeJS.LTS" "--exact" "--source" "winget" "--silent" "--accept-package-agreements" "--accept-source-agreements"
  if ($LASTEXITCODE -ne 0) { throw "WinGet could not install Node.js LTS (OpenJS.NodeJS.LTS). Resolve the WinGet error, then rerun setup." }

  Refresh-ProcessPath
  $nodePath = Find-CommandPath -Names @("node.exe", "node")
  $npmPath = Find-CommandPath -Names @("npm.cmd", "npm")
  if (-not $nodePath -or -not $npmPath) {
    throw "Node.js LTS installation completed, but node.exe and npm.cmd are not both available in PATH. Close and reopen PowerShell, then rerun setup."
  }
  return [pscustomobject]@{ node_path = $nodePath; npm_path = $npmPath; installation = "installed_lts" }
}

function Test-QuoteFlowWebApp {
  param([string]$Path)
  $packageJson = Join-Path $Path "package.json"
  if (-not (Test-Path -LiteralPath $packageJson)) { return $false }
  if (-not (Test-Path -LiteralPath (Join-Path $Path "next.config.ts"))) { return $false }

  try { $package = Get-Content -LiteralPath $packageJson -Raw | ConvertFrom-Json } catch { return $false }
  $scripts = $package.scripts
  return $package.name -eq "quoteflow-webapp" -and $null -ne $scripts -and
    $null -ne $scripts.build -and $null -ne $scripts.start -and $null -ne $scripts.db
}

function Resolve-QuoteFlowWebApp {
  param([string]$RequestedPath)
  if (-not [string]::IsNullOrWhiteSpace($RequestedPath)) {
    if (-not (Test-QuoteFlowWebApp -Path $RequestedPath)) {
      throw "The supplied WebAppPath is not a valid QuoteFlow web app package: $RequestedPath"
    }
    return (Resolve-Path -LiteralPath $RequestedPath).Path
  }

  # This script lives in <skills>\bid-package-orchestrator\signup. Resolve its sibling app without a user-specific path.
  $skillsRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
  $candidate = Join-Path $skillsRoot "quoteflow-webapp"
  if (Test-QuoteFlowWebApp -Path $candidate) { return (Resolve-Path -LiteralPath $candidate).Path }

  throw "QuoteFlow web app was not found. Expected a package named 'quoteflow-webapp' at $candidate."
}

function Get-EnvFileValue {
  param([string[]]$Paths, [string]$Name)
  foreach ($path in $Paths) {
    if (-not (Test-Path -LiteralPath $path)) { continue }
    foreach ($line in Get-Content -LiteralPath $path) {
      if ($line -match "^\s*$([regex]::Escape($Name))\s*=\s*(.+?)\s*$") { return $matches[1].Trim().Trim("'", '"') }
    }
  }
  return $null
}

function Install-WebAppDependencies {
  param([string]$Path, [string]$Npm)
  if (-not (Test-Path -LiteralPath (Join-Path $Path "package-lock.json"))) {
    throw "QuoteFlow web app requires package-lock.json so setup can run npm ci safely."
  }
  if ($SkipDependencyInstall) { return "skipped" }
  Push-Location -LiteralPath $Path
  try {
    $null = & $Npm "ci" "--no-audit" "--fund=false"
    if ($LASTEXITCODE -ne 0) { throw "npm ci failed for QuoteFlow web app with exit code $LASTEXITCODE." }
    return "installed"
  } finally { Pop-Location }
}

function Build-WebApp {
  param([string]$Path, [string]$Npm)
  Push-Location -LiteralPath $Path
  try {
    $null = & $Npm "run" "build"
    if ($LASTEXITCODE -ne 0) { throw "npm run build failed for QuoteFlow web app with exit code $LASTEXITCODE." }
    return "passed"
  } finally { Pop-Location }
}

function Test-DatabaseUrl {
  param([string[]]$EnvFiles)
  $value = if ($env:DATABASE_URL) { $env:DATABASE_URL } else { Get-EnvFileValue -Paths $EnvFiles -Name "DATABASE_URL" }
  if ([string]::IsNullOrWhiteSpace($value)) { throw "DATABASE_URL is not configured in the environment or a local web-app env file." }
  if ($value -notmatch "^postgres(ql)?://") { throw "DATABASE_URL is configured but does not use a PostgreSQL connection URL." }
  return $true
}

function Invoke-DatabasePing {
  param([string]$Path, [string]$Npm)
  Push-Location -LiteralPath $Path
  try {
    $null = & $Npm "run" "db" "--" "ping"
    if ($LASTEXITCODE -ne 0) { throw "Read-only database ping failed. Run npm run db -- ping from the QuoteFlow web app for its non-secret diagnostic output." }
  } finally { Pop-Location }
}

function Test-HttpReady {
  param([int]$Port)
  try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/" -UseBasicParsing -TimeoutSec 2
    return $response.StatusCode -ge 200 -and $response.StatusCode -lt 400
  } catch { return $false }
}

function Start-WebApp {
  param([string]$Path, [string]$Npm)
  $port = 3000
  if (Test-HttpReady -Port $port) { return "already_running" }

  $listener = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
  if ($listener) { throw "Port $port is occupied but does not respond as a QuoteFlow web app. Stop the conflicting process before setup." }

  $logDirectory = Join-Path $Path ".next"
  $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $stdoutLog = Join-Path $logDirectory "quoteflow-start-$timestamp.out.log"
  $stderrLog = Join-Path $logDirectory "quoteflow-start-$timestamp.err.log"
  $process = Start-Process -FilePath $Npm -ArgumentList "run start -- --hostname 127.0.0.1 --port $port" -WorkingDirectory $Path -WindowStyle Hidden -PassThru -RedirectStandardOutput $stdoutLog -RedirectStandardError $stderrLog
  $deadline = (Get-Date).AddSeconds(25)
  do {
    Start-Sleep -Milliseconds 500
    if ($process.HasExited) { throw "npm run start exited with code $($process.ExitCode)." }
    if (Test-HttpReady -Port $port) { return "started" }
  } while ((Get-Date) -lt $deadline)
  throw "QuoteFlow web app did not become ready at http://127.0.0.1:$port within 25 seconds."
}

$result = [ordered]@{ success = $false; node = $null; npm = $null; node_npm_installation = "not_checked"; webapp_path = $null; signup_state_path = $null; webapp_identity = "unverified"; webapp_dependencies = "skipped"; webapp_env_file = $false; database_configured = $false; database_ping = "skipped"; production_build = "skipped"; app_start = "skipped"; app_url = "http://localhost:3000/" }
try {
  $nodeAndNpm = Ensure-NodeAndNpm
  $nodePath = $nodeAndNpm.node_path
  $npmPath = $nodeAndNpm.npm_path
  $result.node_npm_installation = $nodeAndNpm.installation
  $result.node = (& $nodePath --version).Trim()
  $result.npm = (& $npmPath --version).Trim()

  $resolvedWebAppPath = Resolve-QuoteFlowWebApp -RequestedPath $WebAppPath
  $result.webapp_path = $resolvedWebAppPath
  $result.signup_state_path = Join-Path $resolvedWebAppPath "SIGNUP.json"
  $result.webapp_identity = "quoteflow-webapp"
  $result.webapp_dependencies = Install-WebAppDependencies -Path $resolvedWebAppPath -Npm $npmPath

  $webEnvFiles = @((Join-Path $resolvedWebAppPath ".env.local"), (Join-Path $resolvedWebAppPath ".env"))
  $result.webapp_env_file = @($webEnvFiles | Where-Object { Test-Path -LiteralPath $_ }).Count -gt 0
  $result.database_configured = Test-DatabaseUrl -EnvFiles $webEnvFiles
  $result.production_build = Build-WebApp -Path $resolvedWebAppPath -Npm $npmPath
  if (-not $SkipDatabasePing) { Invoke-DatabasePing -Path $resolvedWebAppPath -Npm $npmPath; $result.database_ping = "passed" }
  if (-not $SkipStartupCheck) { $result.app_start = Start-WebApp -Path $resolvedWebAppPath -Npm $npmPath }
  $result.success = $true
  [pscustomobject]$result | ConvertTo-Json -Compress
} catch {
  [pscustomobject]$result | Add-Member -NotePropertyName error -NotePropertyValue $_.Exception.Message
  [pscustomobject]$result | ConvertTo-Json -Compress
  exit 1
}
