param(
  [string]$InputJson = "",
  [string]$EmailBodyContent = ""
)

$ErrorActionPreference = "Stop"
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[Console]::InputEncoding = $utf8NoBom
[Console]::OutputEncoding = $utf8NoBom
$OutputEncoding = $utf8NoBom

function New-ToolResult {
  param(
    [bool]$Success,
    [array]$Items = @(),
    [string]$ErrorMessage = ""
  )

  $rfqItems = @(
    foreach ($item in $Items) {
      [pscustomobject]@{
        item_id = $item.item_id
        company_requirement = [pscustomobject]@{
          company_description = $item.company_description
          qty = $item.qty
          uom = $item.uom
        }
      }
    }
  )

  $result = [ordered]@{
    success = $Success
    items = @($Items)
    rfq_items = @($rfqItems)
  }

  if (-not $Success -and $ErrorMessage) {
    $result.error = $ErrorMessage
  }

  return [pscustomobject]$result
}

function Get-InputText {
  if ($EmailBodyContent) {
    return $EmailBodyContent
  }

  $jsonText = $InputJson
  if (-not $jsonText -and [Console]::IsInputRedirected) {
    $jsonText = [Console]::In.ReadToEnd()
  }

  if ($jsonText) {
    $payload = $jsonText | ConvertFrom-Json
    if ($payload.email_body_content) {
      return [string]$payload.email_body_content
    }
  }

  return ""
}

function New-ExtractedItem {
  param(
    [int]$ItemId,
    [string]$Description,
    [int]$Qty,
    [string]$Uom
  )

  return [pscustomobject]@{
    item_id = $ItemId
    company_description = $Description.Trim()
    qty = $Qty
    uom = if ($Uom) { $Uom.ToUpperInvariant() } else { "EA" }
  }
}

function Extract-PipeDelimitedItems {
  param([string]$Body)

  $items = @()
  $rows = [regex]::Matches($Body, "(?m)^\d+\s*\|.+$")

  foreach ($rowMatch in $rows) {
    $cells = @($rowMatch.Value -split "\|" | ForEach-Object { $_.Trim() })
    if ($cells.Count -lt 3) {
      continue
    }

    $itemNum = 0
    if (-not [int]::TryParse($cells[0], [ref]$itemNum)) {
      continue
    }

    $descriptionCells = @($cells | Select-Object -Skip 1 | Select-Object -First ($cells.Count - 2))
    if ($descriptionCells.Count -gt 1 -and $descriptionCells[0] -match "^\d{5,7}$") {
      $descriptionCells = @($descriptionCells | Select-Object -Skip 1)
    }
    $description = ($descriptionCells -join " | ").Trim()
    $lastCell = $cells[$cells.Count - 1]

    $qty = 1
    $qtyMatch = [regex]::Match($lastCell, "(\d+)")
    if ($qtyMatch.Success) {
      [void][int]::TryParse($qtyMatch.Groups[1].Value, [ref]$qty)
    }

    $uom = "EA"
    $uomMatch = [regex]::Match($lastCell, "\(([A-Z]+)\)", [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
    if ($uomMatch.Success) {
      $uom = $uomMatch.Groups[1].Value.ToUpperInvariant()
    }

    $items += New-ExtractedItem -ItemId $itemNum -Description $description -Qty $qty -Uom $uom
  }

  return @($items)
}

function Extract-TableStateMachine {
  param([string]$Text)

  $startMatch = [regex]::Match(
    $Text,
    "(?:1\.\s*)?(?:Scope\s+of\s+Requirement|Description\s+of\s+Goods\/Services)",
    [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
  )
  if (-not $startMatch.Success) {
    return @()
  }

  $afterStart = $Text.Substring($startMatch.Index)
  $endMatch = [regex]::Match(
    $afterStart,
    "(?im)(?:\d+\.\s*(?:Price\s+Terms|Payment|Delivery|Warranty|Special)|^\s*\*+\s*$|(?:Thank\s+you|Sincerely|Best\s+regards|Kind\s+regards))"
  )

  $tableSlice = if ($endMatch.Success) {
    $afterStart.Substring(0, $endMatch.Index)
  } else {
    $afterStart
  }

  $tableUom = "EA"
  $uomMatch = [regex]::Match($tableSlice, "QTY\s*\(([A-Z]+)\)", [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  if ($uomMatch.Success) {
    $tableUom = $uomMatch.Groups[1].Value.ToUpperInvariant()
  }

  $normalizedText = $tableSlice -replace "[\*_]+", ""
  $normalizedText = $normalizedText -replace "  +", "`n"
  $tokens = @($normalizedText -split "\s+" | Where-Object { $_.Length -gt 0 })

  $state = "EXPECT_ITEM_NUM"
  $lastEmittedItemId = 0
  $currentItemNum = 0
  $descBuffer = New-Object System.Collections.Generic.List[string]
  $items = @()

  for ($i = 0; $i -lt $tokens.Count; $i++) {
    $token = $tokens[$i]

    if ($state -eq "EXPECT_ITEM_NUM") {
      if ($token -match "^\d{1,2}$") {
        $num = [int]$token
        if ($num -eq ($lastEmittedItemId + 1)) {
          $currentItemNum = $num
          $descBuffer.Clear()
          $state = "EXPECT_MAXIMO_OR_DESC"
        }
      }
      continue
    }

    if ($state -eq "EXPECT_MAXIMO_OR_DESC") {
      if ($token -match "^\d{5,7}$") {
        $state = "COLLECT_DESC"
      } else {
        $state = "COLLECT_DESC"
        $descBuffer.Add($token)
      }
      continue
    }

    if ($state -eq "COLLECT_DESC") {
      if ($token -match "^\d{1,4}$") {
        $nextIdx = $i + 1
        $nextToken = if ($nextIdx -lt $tokens.Count) { $tokens[$nextIdx] } else { $null }
        $isQty = ($nextIdx -ge $tokens.Count) -or ($nextToken -and ([string]($lastEmittedItemId + 2) -eq $nextToken))

        if ($isQty) {
          $qty = [int]$token
          $description = ($descBuffer.ToArray() -join " ").Trim()
          $items += New-ExtractedItem -ItemId $currentItemNum -Description $description -Qty $qty -Uom $tableUom
          $lastEmittedItemId = $currentItemNum
          $state = "EXPECT_ITEM_NUM"
          continue
        }
      }

      $descBuffer.Add($token)
    }
  }

  return @($items)
}

function Get-FieldValue {
  param(
    [string]$Text,
    [string]$LabelPattern
  )

  $match = [regex]::Match(
    $Text,
    "(?im)^\s*$LabelPattern\s*:\s*(.+?)\s*$"
  )

  if ($match.Success) {
    return $match.Groups[1].Value.Trim()
  }

  return ""
}

function Extract-KeyValueItem {
  param([string]$Text)

  $description = Get-FieldValue -Text $Text -LabelPattern "Description"
  if (-not $description) {
    return @()
  }

  $manufacturer = Get-FieldValue -Text $Text -LabelPattern "Manufacturer(?:\s*/\s*Package supplier)?"
  $model = Get-FieldValue -Text $Text -LabelPattern "(?:Heat exchanger model|Model)"
  $tag = Get-FieldValue -Text $Text -LabelPattern "(?:Equipment tag|Tag)"
  $service = Get-FieldValue -Text $Text -LabelPattern "Service"
  $material = Get-FieldValue -Text $Text -LabelPattern "(?:Gasket material|Material)"
  $designPressure = Get-FieldValue -Text $Text -LabelPattern "Design pressure"
  $testPressure = Get-FieldValue -Text $Text -LabelPattern "Test pressure"
  $designTemperature = Get-FieldValue -Text $Text -LabelPattern "Design temperature"
  $heatTransferArea = Get-FieldValue -Text $Text -LabelPattern "Heat transfer area"
  $plates = Get-FieldValue -Text $Text -LabelPattern "Number of plates"

  $qty = 1
  $uom = "EA"
  $qtyMatch = [regex]::Match(
    $Text,
    "(?im)^\s*(?:Required\s+)?(?:gasket\s+)?(?:quantity|qty)\s*:\s*(\d+(?:\.\d+)?)\s*([A-Za-z]+)?"
  )
  if ($qtyMatch.Success) {
    $qtyNumber = 0
    if ([double]::TryParse($qtyMatch.Groups[1].Value, [ref]$qtyNumber)) {
      $qty = [int][math]::Ceiling($qtyNumber)
    }
    if ($qtyMatch.Groups[2].Success -and $qtyMatch.Groups[2].Value) {
      $uom = $qtyMatch.Groups[2].Value.ToUpperInvariant()
    }
  }

  $parts = New-Object System.Collections.Generic.List[string]
  $parts.Add($description)
  if ($manufacturer) { $parts.Add("Manufacturer / Package supplier: $manufacturer") }
  if ($model) { $parts.Add("Model: $model") }
  if ($tag) { $parts.Add("Tag: $tag") }
  if ($service) { $parts.Add("Service: $service") }
  if ($plates) { $parts.Add("Number of plates: $plates") }
  if ($material) { $parts.Add("Material: $material") }
  if ($designPressure) { $parts.Add("Design pressure: $designPressure") }
  if ($testPressure) { $parts.Add("Test pressure: $testPressure") }
  if ($designTemperature) { $parts.Add("Design temperature: $designTemperature") }
  if ($heatTransferArea) { $parts.Add("Heat transfer area: $heatTransferArea") }

  $companyDescription = ($parts.ToArray() -join "; ")

  return @(
    New-ExtractedItem -ItemId 1 -Description $companyDescription -Qty $qty -Uom $uom
  )
}

function Extract-RfqItems {
  param([string]$Text)

  $pipeItems = @(Extract-PipeDelimitedItems -Body $Text)
  if ($pipeItems.Count -gt 0) {
    return @($pipeItems)
  }

  $stateMachineItems = @(Extract-TableStateMachine -Text $Text)
  if ($stateMachineItems.Count -gt 0) {
    return @($stateMachineItems)
  }

  $keyValueItems = @(Extract-KeyValueItem -Text $Text)
  if ($keyValueItems.Count -gt 0) {
    return @($keyValueItems)
  }

  return @()
}

try {
  $text = Get-InputText
  if (-not $text.Trim()) {
    New-ToolResult -Success $false -ErrorMessage "email_body_content is required" |
      ConvertTo-Json -Depth 10 -Compress
    exit 1
  }

  $items = @(Extract-RfqItems -Text $text)
  New-ToolResult -Success $true -Items $items |
    ConvertTo-Json -Depth 10
} catch {
  New-ToolResult -Success $false -ErrorMessage $_.Exception.Message |
    ConvertTo-Json -Depth 10 -Compress
  exit 1
}
