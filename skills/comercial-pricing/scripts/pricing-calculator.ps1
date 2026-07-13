param(
  [string]$InputJson,
  [string]$OutputJson
)

$ErrorActionPreference = 'Stop'

function Read-InputJson {
  param([string]$Path)
  if ($Path) {
    return Get-Content -Raw -LiteralPath $Path
  }
  return [Console]::In.ReadToEnd()
}

function To-Decimal {
  param([object]$Value, [decimal]$Default)
  if ($null -eq $Value -or $Value -eq '') { return $Default }
  return [decimal]::Parse([string]$Value, [System.Globalization.CultureInfo]::InvariantCulture)
}

function Round-Unit {
  param([decimal]$Value)
  return [decimal][Math]::Round([double]$Value, 0, [System.MidpointRounding]::AwayFromZero)
}

function Round-Price {
  param([decimal]$Value)
  if ($Value -le 0) { return [decimal]0 }
  $rounded = [decimal]([Math]::Round([double]($Value / 1000), 0, [System.MidpointRounding]::AwayFromZero) * 1000)
  if ($rounded -lt 1000) { return [decimal]1000 }
  return $rounded
}

$jsonText = Read-InputJson -Path $InputJson
if ([string]::IsNullOrWhiteSpace($jsonText)) {
  throw 'No JSON input was provided.'
}

$inputData = $jsonText | ConvertFrom-Json
$items = @($inputData.items)
$outItems = New-Object System.Collections.Generic.List[object]
$totalAmountRaw = [decimal]0
$totalProfit = [decimal]0
$warnings = New-Object System.Collections.Generic.List[string]

foreach ($item in $items) {
  $itemId = $item.item_id
  $qty = To-Decimal $item.qty 0
  $bidderUnitPrice = To-Decimal $item.bidder_unit_price 0

  if ($qty -le 0) {
    $warnings.Add("Item $itemId has missing or non-positive qty.")
  }
  if ($bidderUnitPrice -le 0) {
    $warnings.Add("Item $itemId has missing or non-positive bidder_unit_price.")
  }

  $shippingCost = To-Decimal $item.shipping_cost 0
  $taxRate = To-Decimal $item.tax_rate 1.1
  $exchangeRate = To-Decimal $item.exchange_rate 1.0
  $profitRate = To-Decimal $item.profit_rate 1.25
  $discountRate = To-Decimal $item.discount_rate 0

  $actualUnitPrice = (($bidderUnitPrice + $shippingCost) * $taxRate) * $exchangeRate
  $profitUnitPrice = $actualUnitPrice * $profitRate
  $discountAmount = $profitUnitPrice * $discountRate
  $salesUnitPrice = Round-Unit ($profitUnitPrice - $discountAmount)
  $extPrice = Round-Price ($salesUnitPrice * $qty)
  $potentialProfit = ((Round-Unit $profitUnitPrice) - (Round-Unit $actualUnitPrice)) * $qty

  $totalAmountRaw += $extPrice
  $totalProfit += $potentialProfit

  $outItems.Add([pscustomobject]@{
    item_id = $itemId
    quotation_id = $inputData.quotation_id
    supplier_status_id = $item.supplier_status_id
    supplier_name = $item.supplier_name
    bidder_unit_price = $bidderUnitPrice
    qty = $qty
    uom = $item.uom
    currency_code = $item.currency_code
    shipping_cost = $shippingCost
    tax_rate = $taxRate
    exchange_rate = $exchangeRate
    profit_rate = $profitRate
    discount_rate = $discountRate
    actual_unit_price = $actualUnitPrice
    profit_unit_price = $profitUnitPrice
    discount_amount = $discountAmount
    sales_unit_price = $salesUnitPrice
    ext_price = $extPrice
    potential_profit = $potentialProfit
  })
}

$result = [pscustomobject]@{
  success = $true
  rfq_id = $inputData.rfq_id
  quotation_id = $inputData.quotation_id
  company_id = $inputData.company_id
  user_id = $inputData.user_id
  items = $outItems
  totals = [pscustomobject]@{
    total_amount = (Round-Price $totalAmountRaw)
    total_profit = $totalProfit
  }
  warnings = $warnings
}

$jsonOut = $result | ConvertTo-Json -Depth 20
if ($OutputJson) {
  $dir = Split-Path -Parent $OutputJson
  if ($dir) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
  Set-Content -LiteralPath $OutputJson -Value $jsonOut -Encoding UTF8
}
$jsonOut
