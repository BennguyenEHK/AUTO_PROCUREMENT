param(
  [string]$InputJson,
  [string]$OutputPath,
  [ValidateSet('supplier-search')]
  [string]$Mode = 'supplier-search'
)

$ErrorActionPreference = 'Stop'

function HtmlEncode([object]$Value) {
  if ($null -eq $Value) { return '' }
  return [System.Net.WebUtility]::HtmlEncode([string]$Value)
}

function AsText([object]$Value) {
  if ($null -eq $Value) { return 'N/A' }
  if ($Value -is [string]) {
    if ([string]::IsNullOrWhiteSpace($Value)) { return 'N/A' }
    return $Value
  }
  try {
    return ($Value | ConvertTo-Json -Depth 20)
  } catch {
    return [string]$Value
  }
}

function Get-Array($Value) {
  if ($null -eq $Value) { return @() }
  if ($Value -is [System.Array]) { return @($Value) }
  return @($Value)
}

if ($InputJson) {
  $jsonText = Get-Content -Raw -LiteralPath $InputJson
} else {
  $jsonText = [Console]::In.ReadToEnd()
}

if ([string]::IsNullOrWhiteSpace($jsonText)) {
  throw 'No JSON input was provided. Pass -InputJson or pipe JSON to stdin.'
}

$report = $jsonText | ConvertFrom-Json

if (-not $OutputPath) {
  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $OutputPath = Join-Path $PSScriptRoot "output\search\supplier-search-$stamp.html"
}

$outDir = Split-Path -Parent $OutputPath
if ($outDir) {
  New-Item -ItemType Directory -Force -Path $outDir | Out-Null
}

$items = @(Get-Array $report.items)
$itemHtml = New-Object System.Collections.Generic.List[string]

foreach ($item in $items) {
  $itemId = HtmlEncode (AsText $item.item_id)
  $desc = HtmlEncode (AsText $item.company_description)
  $qty = HtmlEncode (AsText $item.qty)
  $uom = HtmlEncode (AsText $item.uom)
  $summary = HtmlEncode (AsText $item.agent_item_summary)

  $images = @(Get-Array $item.images | Where-Object { $_.url } | Select-Object -First 3)
  $imageHtml = if ($images.Count -gt 0) {
    (($images | ForEach-Object {
      $url = HtmlEncode $_.url
      $caption = HtmlEncode (AsText $(if ($_.caption) { $_.caption } else { $_.url }))
      "<figure><img src=`"$url`" alt=`"$caption`" loading=`"lazy`"><figcaption>$caption</figcaption></figure>"
    }) -join "`n")
  } else {
    '<p class="empty">No verified product image available.</p>'
  }

  $suppliers = @(Get-Array $item.suppliers)
  $supplierHtml = if ($suppliers.Count -gt 0) {
    (($suppliers | ForEach-Object {
      $name = HtmlEncode (AsText $_.supplier_name)
      $url = HtmlEncode (AsText $_.source_url)
      $info = HtmlEncode (AsText $_.other_information)
      $matchTypeRaw = if ($_.match_type -eq 'exact_match') { 'exact_match' } else { 'alternative' }
      $matchType = HtmlEncode $matchTypeRaw
      $score = HtmlEncode (AsText $_.match_score)
      $reason = HtmlEncode (AsText $_.match_reason)
      $diff = HtmlEncode (AsText $(if ($_.technical_differences) { $_.technical_differences } else { 'None' }))
      $alt = HtmlEncode (AsText $(if ($_.alternative_reason) { $_.alternative_reason } else { 'N/A' }))
      @"
<section class="supplier">
  <h3>$name</h3>
  <p class="source"><strong>Source</strong><br><a href="$url" target="_blank" rel="noopener noreferrer">$url</a></p>
  <div class="result-grid">
    <p class="span"><strong>Other information:</strong> $info</p>
    <p><strong>Match type:</strong> <span class="badge $matchType">$matchType</span></p>
    <p><strong>Match score:</strong> $score</p>
    <p class="span"><strong>Match reason:</strong> $reason</p>
    <p class="span"><strong>Technical differences:</strong> $diff</p>
    <p class="span"><strong>Alternative reason:</strong> $alt</p>
  </div>
</section>
"@
    }) -join "`n")
  } else {
    '<p class="empty">No verified supplier sources available.</p>'
  }

  $gaps = @(Get-Array $item.gaps)
  $gapHtml = if ($gaps.Count -gt 0) {
    '<div class="gaps"><strong>Gaps:</strong> ' + (HtmlEncode (($gaps | ForEach-Object { AsText $_ }) -join '; ')) + '</div>'
  } else { '' }

  $searchText = HtmlEncode (($itemId, $desc, $qty, $uom, ($suppliers | ForEach-Object { "$(AsText $_.supplier_name) $(AsText $_.source_url) $(AsText $_.match_type) $(AsText $_.match_reason) $(AsText $_.technical_differences)" })) -join ' ')

  $itemHtml.Add(@"
<article class="item-card" data-search="$searchText">
  <div class="item-head">
    <h2>ITEM ${itemId}: $desc</h2>
    <div class="original-grid">
      <div class="field"><strong>item_id</strong>$itemId</div>
      <div class="field"><strong>qty</strong>$qty</div>
      <div class="field"><strong>uom</strong>$uom</div>
      <div class="field"><strong>company_description</strong>$desc</div>
      <div class="field summary"><strong>agent_item_summary</strong><pre>$summary</pre></div>
    </div>
  </div>
  <div class="images">$imageHtml</div>
  <div class="supplier-list">$supplierHtml</div>
  $gapHtml
</article>
"@)
}

$generatedAt = HtmlEncode (AsText $(if ($report.generated_at) { $report.generated_at } else { Get-Date -Format 'yyyy-MM-dd HH:mm:ss' }))
$rfqId = HtmlEncode (AsText $report.rfq_id)
$companyId = HtmlEncode (AsText $report.company_id)
$userId = HtmlEncode (AsText $report.user_id)
$itemCount = $items.Count
$body = $itemHtml -join "`n"

$html = @"
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Supplier Search Report</title>
  <style>
    :root { --bg:#f4f6f8; --panel:#fff; --ink:#18212f; --muted:#647083; --line:#d7dde6; --accent:#0f766e; --good:#166534; --warn:#9a3412; }
    * { box-sizing:border-box; }
    body { margin:0; background:var(--bg); color:var(--ink); font:14px/1.5 Arial, Helvetica, sans-serif; }
    header { position:sticky; top:0; z-index:10; background:var(--panel); border-bottom:1px solid var(--line); padding:16px 22px; }
    h1 { margin:0 0 8px; font-size:22px; }
    .meta { display:flex; gap:10px 18px; flex-wrap:wrap; color:var(--muted); margin-bottom:12px; }
    .search { display:flex; gap:10px; align-items:center; }
    .search input { width:min(680px,100%); padding:10px 12px; border:1px solid var(--line); border-radius:7px; font:inherit; }
    main { max-width:1180px; margin:0 auto; padding:20px; }
    .item-card { background:var(--panel); border:1px solid var(--line); border-radius:8px; margin-bottom:18px; overflow:hidden; }
    .item-head { padding:18px 20px; border-bottom:1px solid var(--line); }
    h2 { margin:0 0 12px; font-size:18px; }
    .original-grid { display:grid; grid-template-columns:repeat(4,minmax(120px,1fr)); gap:10px; }
    .field { background:#fbfcfd; border:1px solid var(--line); border-radius:6px; padding:8px 10px; overflow-wrap:anywhere; }
    .field strong { display:block; color:var(--muted); font-size:11px; text-transform:uppercase; letter-spacing:.04em; margin-bottom:3px; }
    .summary { grid-column:1 / -1; }
    pre { margin:0; white-space:pre-wrap; font:12px/1.45 Consolas, monospace; }
    .images { display:flex; gap:12px; padding:16px 20px 0; overflow-x:auto; }
    figure { margin:0; width:180px; flex:0 0 180px; }
    img { width:180px; height:132px; object-fit:contain; border:1px solid var(--line); border-radius:6px; background:#fff; }
    figcaption { color:var(--muted); font-size:12px; overflow-wrap:anywhere; }
    .supplier-list { display:grid; gap:14px; padding:16px 20px 20px; }
    .supplier { border:1px solid var(--line); border-radius:8px; padding:14px; }
    .supplier h3 { margin:0 0 8px; font-size:16px; }
    .source { overflow-wrap:anywhere; }
    a { color:var(--accent); font-weight:700; }
    .result-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px 14px; }
    .result-grid p { margin:0; }
    .span { grid-column:1 / -1; }
    .badge { display:inline-block; border-radius:999px; padding:3px 8px; font-size:12px; font-weight:700; background:#fff3e8; color:var(--warn); }
    .badge.exact_match { background:#e8f6ed; color:var(--good); }
    .gaps,.empty { color:var(--muted); padding:14px 20px; }
    mark { background:#fef3c7; padding:0 2px; }
    @media (max-width:760px) { main{padding:14px;} header{padding:14px 16px;} .original-grid,.result-grid{grid-template-columns:1fr;} }
  </style>
</head>
<body>
  <header>
    <h1>Supplier Search Report</h1>
    <div class="meta">
      <span><strong>Generated:</strong> $generatedAt</span>
      <span><strong>RFQ:</strong> $rfqId</span>
      <span><strong>Company:</strong> $companyId</span>
      <span><strong>User:</strong> $userId</span>
      <span><strong>Items:</strong> $itemCount</span>
    </div>
    <div class="search">
      <input id="searchInput" type="search" placeholder="Search by item, supplier, source, match type, reason, or difference" autofocus>
      <span id="resultCount">$itemCount shown</span>
    </div>
  </header>
  <main id="items">
    $body
  </main>
  <script>
    const input = document.getElementById('searchInput');
    const count = document.getElementById('resultCount');
    const cards = Array.from(document.querySelectorAll('.item-card'));
    function filterCards() {
      const q = input.value.trim().toLowerCase();
      let shown = 0;
      for (const card of cards) {
        const ok = !q || card.dataset.search.toLowerCase().includes(q);
        card.style.display = ok ? '' : 'none';
        if (ok) shown++;
      }
      count.textContent = shown + ' shown';
    }
    input.addEventListener('input', filterCards);
  </script>
</body>
</html>
"@

Set-Content -LiteralPath $OutputPath -Value $html -Encoding UTF8

[pscustomobject]@{
  success = $true
  mode = $Mode
  output_path = (Resolve-Path -LiteralPath $OutputPath).Path
  item_count = $itemCount
} | ConvertTo-Json -Depth 5
