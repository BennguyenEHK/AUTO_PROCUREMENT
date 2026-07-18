param(
  [string]$InputJson,
  [string]$OutputPath,
  [ValidateSet('supplier-search','rfq-analysis','response-impact')]
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

function Has-Value([object]$Value) {
  if ($null -eq $Value) { return $false }
  if ($Value -is [string]) { return -not [string]::IsNullOrWhiteSpace($Value) }
  if ($Value -is [System.Array]) { return $Value.Count -gt 0 }
  if ($Value -is [System.Collections.IEnumerable] -and -not ($Value -is [string])) {
    foreach ($entry in $Value) { return $true }
    return $false
  }
  return $true
}

function Convert-ListHtml {
  param(
    [string]$Title,
    [object]$Value
  )

  $values = @(Get-Array $Value | Where-Object { Has-Value $_ })
  if ($values.Count -eq 0) { return '' }

  $items = (($values | ForEach-Object {
    '<li>' + (HtmlEncode (AsText $_)) + '</li>'
  }) -join "`n")

  return "<div class=`"summary-group`"><h4>$(HtmlEncode $Title)</h4><ul>$items</ul></div>"
}

function Get-DisplayLabel([string]$Name) {
  $labels = @{
    coo_origin = 'COO / Origin'
    manufacturer_authorization = 'Manufacturer Authorization'
    incoterms = 'Incoterms'
    payment_terms = 'Payment Terms'
    bid_bonds = 'Bid Bonds'
    technical_commercial_forms = 'Technical / Commercial Forms'
    source_refs = 'Source References'
  }

  if ($labels.ContainsKey($Name)) {
    return $labels[$Name]
  }

  return (Get-Culture).TextInfo.ToTitleCase(($Name -replace '_', ' '))
}

function Format-AgentSummaryHtml([object]$Summary) {
  if (-not (Has-Value $Summary)) {
    return '<p class="empty compact">No item functional summary available.</p>'
  }

  $summaryObject = $Summary
  if ($Summary -is [string]) {
    $trimmed = $Summary.Trim()
    if ([string]::IsNullOrWhiteSpace($trimmed)) {
      return '<p class="empty compact">No item functional summary available.</p>'
    }
    if ($trimmed.StartsWith('{') -or $trimmed.StartsWith('[')) {
      try {
        $summaryObject = $trimmed | ConvertFrom-Json
      } catch {
        return '<p>' + (HtmlEncode $trimmed) + '</p>'
      }
    } else {
      return '<p>' + (HtmlEncode $trimmed) + '</p>'
    }
  }

  $sections = New-Object System.Collections.Generic.List[string]
  $sections.Add((Convert-ListHtml -Title 'Identification' -Value $summaryObject.identification))
  $sections.Add((Convert-ListHtml -Title 'Classification' -Value $summaryObject.classification))
  $sections.Add((Convert-ListHtml -Title 'Application' -Value $summaryObject.application))
  $sections.Add((Convert-ListHtml -Title 'Purpose' -Value $summaryObject.purpose))
  $sections.Add((Convert-ListHtml -Title 'Key features' -Value $summaryObject.features))

  $html = (($sections.ToArray() | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }) -join "`n")
  if ([string]::IsNullOrWhiteSpace($html)) {
    return '<p>' + (HtmlEncode (AsText $Summary)) + '</p>'
  }

  return '<div class="agent-summary">' + $html + '</div>'
}

function Format-RequirementGroupHtml {
  param(
    [string]$Title,
    [object]$Value
  )

  $content = ''
  if ($Value -is [string]) {
    if (-not [string]::IsNullOrWhiteSpace($Value)) {
      $content = '<ul><li>' + (HtmlEncode $Value) + '</li></ul>'
    }
  } elseif ($Value -is [System.Array]) {
    $values = @(Get-Array $Value | Where-Object { Has-Value $_ })
    if ($values.Count -gt 0) {
      $items = (($values | ForEach-Object { '<li>' + (HtmlEncode (AsText $_)) + '</li>' }) -join "`n")
      $content = "<ul>$items</ul>"
    }
  } elseif ($null -ne $Value) {
    $propertyHtml = New-Object System.Collections.Generic.List[string]
    foreach ($prop in $Value.PSObject.Properties) {
      if ($prop.Name -eq 'source_refs') { continue }
      $values = @(Get-Array $prop.Value | Where-Object { Has-Value $_ })
      if ($values.Count -gt 0) {
        $items = (($values | ForEach-Object { '<li>' + (HtmlEncode (AsText $_)) + '</li>' }) -join "`n")
        $label = Get-DisplayLabel $prop.Name
        $propertyHtml.Add("<div><h4>$(HtmlEncode $label)</h4><ul>$items</ul></div>")
      }
    }
    $content = ($propertyHtml.ToArray() -join "`n")
  }

  if ([string]::IsNullOrWhiteSpace($content)) {
    $content = '<p class="empty compact">Not identified in the available RFQ data.</p>'
  }

  return "<section class=`"baseline-card`"><h3>$(HtmlEncode $Title)</h3>$content</section>"
}

function First-Value {
  param([object[]]$Values)

  foreach ($value in $Values) {
    if (Has-Value $value) {
      return $value
    }
  }

  return $null
}

function Format-ImpactSectionHtml {
  param(
    [string]$Title,
    [object]$Value
  )

  if (-not (Has-Value $Value)) {
    return "<section class=`"panel`"><h2>$(HtmlEncode $Title)</h2><p class=`"empty compact`">Not applicable or not called for this response.</p></section>"
  }

  if ($Value -is [string]) {
    return "<section class=`"panel`"><h2>$(HtmlEncode $Title)</h2><p>$(HtmlEncode $Value)</p></section>"
  }

  if ($Value -is [System.Array]) {
    $items = (($Value | ForEach-Object { '<li>' + (HtmlEncode (AsText $_)) + '</li>' }) -join "`n")
    return "<section class=`"panel`"><h2>$(HtmlEncode $Title)</h2><ul>$items</ul></section>"
  }

  $rows = New-Object System.Collections.Generic.List[string]
  foreach ($prop in $Value.PSObject.Properties) {
    if (Has-Value $prop.Value) {
      $label = HtmlEncode (Get-DisplayLabel $prop.Name)
      $val = HtmlEncode (AsText $prop.Value)
      $rows.Add("<tr><th>$label</th><td>$val</td></tr>")
    }
  }

  if ($rows.Count -eq 0) {
    return "<section class=`"panel`"><h2>$(HtmlEncode $Title)</h2><p class=`"empty compact`">No details provided.</p></section>"
  }

  return "<section class=`"panel`"><h2>$(HtmlEncode $Title)</h2><table>$($rows.ToArray() -join "`n")</table></section>"
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
  if ($Mode -eq 'rfq-analysis') {
    $OutputPath = Join-Path $PSScriptRoot "output\rfq-analysis\rfq-analysis-$stamp.html"
  } elseif ($Mode -eq 'response-impact') {
    $OutputPath = Join-Path $PSScriptRoot "output\response-impact\response-impact-$stamp.html"
  } else {
    $OutputPath = Join-Path $PSScriptRoot "output\search\supplier-search-$stamp.html"
  }
}

$outDir = Split-Path -Parent $OutputPath
if ($outDir) {
  New-Item -ItemType Directory -Force -Path $outDir | Out-Null
}

if ($Mode -eq 'response-impact') {
  $generatedAt = HtmlEncode (AsText $(if ($report.generated_at) { $report.generated_at } else { Get-Date -Format 'yyyy-MM-dd HH:mm:ss' }))
  $rfqId = HtmlEncode (AsText (First-Value @($report.rfq_reference, $report.rfq_id)))
  $responseSource = $report.response_source
  $partyType = HtmlEncode (AsText (First-Value @($responseSource.party_type, $report.party_type)))
  $subject = HtmlEncode (AsText (First-Value @($responseSource.subject, $report.subject, 'Response Impact Report')))
  $sourceRef = HtmlEncode (AsText (First-Value @($responseSource.source_reference, $responseSource.message_id, $report.source_reference)))
  $priorCheckpoint = HtmlEncode (AsText $report.prior_checkpoint)
  $nextAction = HtmlEncode (AsText $report.next_required_action)
  $recommendation = HtmlEncode (AsText $report.recommendation)
  $routing = $report.routing_decision
  $skillsCalled = HtmlEncode ((@(Get-Array $routing.skills_called) | ForEach-Object { AsText $_ }) -join ', ')
  $skillsSkipped = HtmlEncode ((@(Get-Array $routing.skills_skipped) | ForEach-Object { AsText $_ }) -join ', ')

  $affectedRows = @(Get-Array $report.affected_items | ForEach-Object {
    $itemId = HtmlEncode (AsText $_.item_id)
    $fields = HtmlEncode ((@(Get-Array $_.fields) | ForEach-Object { AsText $_ }) -join ', ')
    $impact = HtmlEncode (AsText $_.impact)
    "<tr><td>$itemId</td><td>$fields</td><td>$impact</td></tr>"
  })
  $affectedHtml = if ($affectedRows.Count -gt 0) {
    '<table><thead><tr><th>Item</th><th>Fields</th><th>Impact</th></tr></thead><tbody>' + ($affectedRows -join "`n") + '</tbody></table>'
  } else {
    '<p class="empty compact">No affected items listed.</p>'
  }

  $quoteHtml = Format-ImpactSectionHtml -Title 'Supplier Quote Normalization Result' -Value $report.supplier_quote_normalization
  $techHtml = Format-ImpactSectionHtml -Title 'Technical Compliance Impact' -Value $report.technical_compliance_impact
  $certHtml = Format-ImpactSectionHtml -Title 'Certificate / Origin / Document Impact' -Value $report.certificate_origin_document_impact
  $proofHtml = Format-ImpactSectionHtml -Title 'Numerical Proof Appendix' -Value $report.numerical_proof
  $blockerHtml = Format-ImpactSectionHtml -Title 'Blockers' -Value $report.blockers

  $html = @"
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Response Impact Report</title>
  <style>
    :root { --bg:#f5f7fa; --panel:#fff; --ink:#18212f; --muted:#647083; --line:#d7dde6; --accent:#0f766e; --warn:#9a3412; }
    * { box-sizing:border-box; }
    body { margin:0; background:var(--bg); color:var(--ink); font:14px/1.5 Arial, Helvetica, sans-serif; }
    header { position:sticky; top:0; z-index:10; background:var(--panel); border-bottom:1px solid var(--line); padding:16px 22px; }
    h1 { margin:0 0 8px; font-size:22px; }
    h2 { margin:0 0 12px; font-size:18px; }
    main { max-width:1180px; margin:0 auto; padding:20px; }
    .meta { display:flex; gap:10px 18px; flex-wrap:wrap; color:var(--muted); margin-bottom:10px; }
    .decision { border-left:4px solid var(--accent); background:#ecfdf5; padding:10px 12px; }
    .panel { background:var(--panel); border:1px solid var(--line); border-radius:8px; padding:16px; margin:0 0 16px; }
    table { width:100%; border-collapse:collapse; background:#fff; }
    th, td { border:1px solid var(--line); padding:8px; text-align:left; vertical-align:top; }
    th { background:#eef2f7; width:26%; }
    .empty { color:var(--muted); }
    .compact { margin:0; }
    .route-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:10px; }
    .route-grid p { margin:0; border:1px solid var(--line); border-radius:6px; padding:8px; background:#fbfcfe; }
  </style>
</head>
<body>
  <header>
    <h1>Response Impact Report</h1>
    <div class="meta">
      <span><strong>Generated:</strong> $generatedAt</span>
      <span><strong>RFQ:</strong> $rfqId</span>
      <span><strong>Party:</strong> $partyType</span>
      <span><strong>Prior checkpoint:</strong> $priorCheckpoint</span>
    </div>
    <div class="decision"><strong>Recommendation:</strong> $recommendation &nbsp; <strong>Next action:</strong> $nextAction</div>
  </header>
  <main>
    <section class="panel">
      <h2>Response Source</h2>
      <div class="route-grid">
        <p><strong>Subject</strong><br>$subject</p>
        <p><strong>Source</strong><br>$sourceRef</p>
      </div>
    </section>
    <section class="panel">
      <h2>Routing Decision</h2>
      <div class="route-grid">
        <p><strong>Meaningful bid impact</strong><br>$(HtmlEncode (AsText $routing.meaningful_bid_impact))</p>
        <p><strong>Skills called</strong><br>$skillsCalled</p>
        <p><strong>Skills skipped</strong><br>$skillsSkipped</p>
        <p><strong>Reason</strong><br>$(HtmlEncode (AsText $routing.reason))</p>
      </div>
    </section>
    <section class="panel">
      <h2>Affected Items / Fields</h2>
      $affectedHtml
    </section>
    $quoteHtml
    $techHtml
    $certHtml
    $proofHtml
    $blockerHtml
  </main>
</body>
</html>
"@

  Set-Content -LiteralPath $OutputPath -Value $html -Encoding UTF8

  [pscustomobject]@{
    success = $true
    mode = $Mode
    output_path = (Resolve-Path -LiteralPath $OutputPath).Path
    affected_item_count = $affectedRows.Count
  } | ConvertTo-Json -Depth 5
  return
}

if ($Mode -eq 'rfq-analysis') {
  $rfqAnalysis = if ($report.rfq_analysis) { $report.rfq_analysis } else { $report }
  $customer = First-Value @($report.customer_info, $report.customer, $report.customer_partial, $rfqAnalysis.customer_info, $rfqAnalysis.customer_partial)
  $rfqId = HtmlEncode (AsText (First-Value @($report.rfq_reference, $rfqAnalysis.rfq_reference, $report.rfq_id)))
  $generatedAt = HtmlEncode (AsText $(if ($report.generated_at) { $report.generated_at } else { Get-Date -Format 'yyyy-MM-dd HH:mm:ss' }))
  $subject = HtmlEncode (AsText (First-Value @($rfqAnalysis.subject, $report.subject, 'RFQ Analysis Report')))
  $analysisContent = HtmlEncode (AsText (First-Value @($rfqAnalysis.analysis_content, $report.analysis_content)))
  $deadlineText = if ($rfqAnalysis.deadline) { $rfqAnalysis.deadline } elseif ($rfqAnalysis.deadline_period -or $rfqAnalysis.closing_time) { (@($rfqAnalysis.deadline_period, $rfqAnalysis.closing_time) | Where-Object { Has-Value $_ }) -join ' / ' } else { '' }

  $deadlineHtml = Format-RequirementGroupHtml -Title 'Deadline' -Value $deadlineText
  $specialHtml = Format-RequirementGroupHtml -Title 'Special / Further Requirements' -Value $rfqAnalysis.special_requirements
  $documentsHtml = Format-RequirementGroupHtml -Title 'Required Documents' -Value $rfqAnalysis.required_documents
  $clarificationsHtml = Format-RequirementGroupHtml -Title 'Clarifications' -Value $rfqAnalysis.clarifications

  $customerName = HtmlEncode (AsText (First-Value @($customer.company_name, $customer.customer_name)))
  $customerAddress = HtmlEncode (AsText (First-Value @($customer.customer_address, $customer.address)))
  $attention = HtmlEncode (AsText $customer.attention_person)
  $customerEmail = HtmlEncode (AsText $customer.email)
  $customerPhone = HtmlEncode (AsText (First-Value @($customer.phone, $customer.tel)))
  $customerFax = HtmlEncode (AsText $customer.fax_number)
  $ccPeople = HtmlEncode ((Get-Array $customer.carbon_copy_person | ForEach-Object { AsText $_ }) -join '; ')

  $rawItems = @(Get-Array (First-Value @($report.items, $report.rfq_items)))
  $rows = New-Object System.Collections.Generic.List[string]
  foreach ($item in $rawItems) {
    $requirement = if ($item.company_requirement) { $item.company_requirement } else { $item }
    $itemId = HtmlEncode (AsText $item.item_id)
    $desc = HtmlEncode (AsText (First-Value @($item.company_description, $requirement.company_description)))
    $qty = HtmlEncode (AsText (First-Value @($item.qty, $requirement.qty)))
    $uom = HtmlEncode (AsText (First-Value @($item.uom, $requirement.uom)))
    $summaryHtml = Format-AgentSummaryHtml $item.agent_item_summary
    $rows.Add("<tr><td>$itemId</td><td>$qty</td><td>$uom</td><td>$desc</td><td>$summaryHtml</td></tr>")
  }
  $itemRows = if ($rows.Count -gt 0) { $rows.ToArray() -join "`n" } else { '<tr><td colspan="5">No extracted items available for validation.</td></tr>' }

  $html = @"
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>RFQ Analysis Report</title>
  <style>
    :root { --bg:#f4f6f8; --panel:#fff; --ink:#18212f; --muted:#647083; --line:#d7dde6; --accent:#0f766e; }
    * { box-sizing:border-box; }
    body { margin:0; background:var(--bg); color:var(--ink); font:14px/1.5 Arial, Helvetica, sans-serif; }
    header { position:sticky; top:0; z-index:10; background:var(--panel); border-bottom:1px solid var(--line); padding:16px 22px; }
    h1 { margin:0 0 8px; font-size:22px; }
    h2 { margin:0 0 12px; font-size:18px; }
    main { max-width:1180px; margin:0 auto; padding:20px; }
    section { background:var(--panel); border:1px solid var(--line); border-radius:8px; margin-bottom:18px; padding:18px 20px; }
    .meta { display:flex; gap:10px 18px; flex-wrap:wrap; color:var(--muted); }
    .review-note { border-left:4px solid var(--accent); padding:10px 12px; background:#ecfdf5; margin-top:10px; }
    .grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:10px; }
    .field,.baseline-card { background:#fbfcfd; border:1px solid var(--line); border-radius:7px; padding:10px 12px; overflow-wrap:anywhere; }
    .field strong { display:block; color:var(--muted); font-size:11px; text-transform:uppercase; margin-bottom:3px; }
    .baseline-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
    .baseline-card h3 { margin:0 0 8px; font-size:15px; }
    .baseline-card h4,.summary-group h4 { margin:8px 0 4px; font-size:12px; color:var(--muted); text-transform:uppercase; }
    .baseline-card ul,.summary-group ul { margin:0; padding-left:18px; }
    .agent-summary { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px 18px; }
    .summary-group:first-child { grid-column:1 / -1; }
    .empty { color:var(--muted); }
    .compact { padding:0; margin:0; }
    table { width:100%; border-collapse:collapse; background:#fff; }
    th,td { border:1px solid var(--line); padding:8px 10px; vertical-align:top; text-align:left; }
    th { background:#eef3f7; color:#243044; }
    @media (max-width:760px) { main{padding:14px;} header{padding:14px 16px;} .grid,.baseline-grid,.agent-summary{grid-template-columns:1fr;} }
  </style>
</head>
<body>
  <header>
    <h1>RFQ Analysis Report</h1>
    <div class="meta">
      <span><strong>Generated:</strong> $generatedAt</span>
      <span><strong>RFQ:</strong> $rfqId</span>
      <span><strong>Items:</strong> $($rawItems.Count)</span>
    </div>
    <div class="review-note">Validate this RFQ baseline before supplier search. Supplier search should start only after approval or an explicit skip instruction.</div>
  </header>
  <main>
    <section>
      <h2>$subject</h2>
      <p>$analysisContent</p>
    </section>
    <section>
      <h2>Customer</h2>
      <div class="grid">
        <div class="field"><strong>Company</strong>$customerName</div>
        <div class="field"><strong>Attention</strong>$attention</div>
        <div class="field"><strong>Email</strong>$customerEmail</div>
        <div class="field"><strong>Phone</strong>$customerPhone</div>
        <div class="field"><strong>Fax</strong>$customerFax</div>
        <div class="field"><strong>Carbon Copy</strong>$ccPeople</div>
        <div class="field" style="grid-column:1 / -1;"><strong>Address</strong>$customerAddress</div>
      </div>
    </section>
    <section>
      <h2>RFQ Baseline</h2>
      <div class="baseline-grid">
        $deadlineHtml
        $specialHtml
        $documentsHtml
        $clarificationsHtml
      </div>
    </section>
    <section>
      <h2>Extracted Items</h2>
      <table>
        <thead><tr><th>Item</th><th>Qty</th><th>Unit</th><th>Customer Description</th><th>Functional Summary</th></tr></thead>
        <tbody>$itemRows</tbody>
      </table>
    </section>
  </main>
</body>
</html>
"@

  Set-Content -LiteralPath $OutputPath -Value $html -Encoding UTF8

  [pscustomobject]@{
    success = $true
    mode = $Mode
    output_path = (Resolve-Path -LiteralPath $OutputPath).Path
    item_count = $rawItems.Count
  } | ConvertTo-Json -Depth 5
  return
}

$items = @(Get-Array $report.items)
$itemHtml = New-Object System.Collections.Generic.List[string]

foreach ($item in $items) {
  $itemId = HtmlEncode (AsText $item.item_id)
  $desc = HtmlEncode (AsText $item.company_description)
  $qty = HtmlEncode (AsText $item.qty)
  $uom = HtmlEncode (AsText $item.uom)
  $summaryHtml = Format-AgentSummaryHtml $item.agent_item_summary

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
      $manufacturer = HtmlEncode (AsText $_.manufacturer)
      $info = HtmlEncode (AsText $_.other_information)
      if (-not $info) { $info = HtmlEncode (AsText $_.bidder_description) }
      $matchTypeRaw = if ($_.match_type -eq 'exact_match') { 'exact_match' } else { 'alternative' }
      $matchType = HtmlEncode $matchTypeRaw
      $score = HtmlEncode (AsText $_.match_score)
      $reason = HtmlEncode (AsText $_.match_reason)
      $diff = HtmlEncode (AsText $(if ($_.technical_differences) { $_.technical_differences } else { 'None' }))
      $alt = HtmlEncode (AsText $(if ($_.alternative_reason) { $_.alternative_reason } else { 'N/A' }))
      $contactParts = @()
      if ((AsText $_.contact_email).Trim()) { $contactParts += "Email: $(HtmlEncode (AsText $_.contact_email))" }
      if ((AsText $_.contact_phone).Trim()) { $contactParts += "Phone: $(HtmlEncode (AsText $_.contact_phone))" }
      if ((AsText $_.social_contact).Trim()) { $contactParts += "Other: $(HtmlEncode (AsText $_.social_contact))" }
      $contactHtml = if ($contactParts.Count -gt 0) { '<p class="span"><strong>Contact:</strong> ' + ($contactParts -join ' | ') + '</p>' } else { '' }
      $commercialParts = @()
      if ((AsText $_.bidder_unit_price).Trim()) { $commercialParts += "Unit price: $(HtmlEncode (AsText $_.bidder_unit_price))" }
      if ((AsText $_.currency_code).Trim()) { $commercialParts += "Currency: $(HtmlEncode (AsText $_.currency_code))" }
      if ((AsText $_.delivery_time).Trim()) { $commercialParts += "Delivery: $(HtmlEncode (AsText $_.delivery_time))" }
      if ((AsText $_.available_qty).Trim()) { $commercialParts += "Available qty: $(HtmlEncode (AsText $_.available_qty))" }
      if ((AsText $_.selling_unit).Trim()) { $commercialParts += "Selling unit: $(HtmlEncode (AsText $_.selling_unit))" }
      if ((AsText $_.pack_size).Trim()) { $commercialParts += "Pack size: $(HtmlEncode (AsText $_.pack_size))" }
      $commercialHtml = if ($commercialParts.Count -gt 0) { '<p class="span"><strong>Commercial / availability:</strong> ' + ($commercialParts -join ' | ') + '</p>' } else { '' }
      @"
<section class="supplier">
  <h3>$name</h3>
  <p class="source"><strong>Source</strong><br><a href="$url" target="_blank" rel="noopener noreferrer">$url</a></p>
  <div class="result-grid">
    <p><strong>Manufacturer:</strong> $manufacturer</p>
    $contactHtml
    $commercialHtml
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

  $searchText = HtmlEncode (($itemId, $desc, $qty, $uom, ($suppliers | ForEach-Object { "$(AsText $_.supplier_name) $(AsText $_.source_url) $(AsText $_.manufacturer) $(AsText $_.contact_email) $(AsText $_.contact_phone) $(AsText $_.social_contact) $(AsText $_.currency_code) $(AsText $_.available_qty) $(AsText $_.selling_unit) $(AsText $_.pack_size) $(AsText $_.match_type) $(AsText $_.match_reason) $(AsText $_.technical_differences)" })) -join ' ')

  $itemHtml.Add(@"
<article class="item-card" data-search="$searchText">
  <div class="item-head">
    <h2>ITEM ${itemId}: $desc</h2>
    <div class="original-grid">
      <div class="field"><strong>item_id</strong>$itemId</div>
      <div class="field"><strong>qty</strong>$qty</div>
      <div class="field"><strong>uom</strong>$uom</div>
      <div class="field"><strong>company_description</strong>$desc</div>
      <div class="field summary"><strong>agent_item_summary</strong>$summaryHtml</div>
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

$rfqAnalysis = if ($report.rfq_analysis) { $report.rfq_analysis } else { $report }
$deadlineText = if ($rfqAnalysis.deadline) { $rfqAnalysis.deadline } elseif ($rfqAnalysis.deadline_period -or $rfqAnalysis.closing_time) { (@($rfqAnalysis.deadline_period, $rfqAnalysis.closing_time) | Where-Object { Has-Value $_ }) -join ' / ' } else { '' }
$deadlineHtml = Format-RequirementGroupHtml -Title 'Deadline' -Value $deadlineText
$specialHtml = Format-RequirementGroupHtml -Title 'Special / Further Requirements' -Value $rfqAnalysis.special_requirements
$documentsHtml = Format-RequirementGroupHtml -Title 'Required Documents' -Value $rfqAnalysis.required_documents
$clarificationsHtml = Format-RequirementGroupHtml -Title 'Clarifications' -Value $rfqAnalysis.clarifications

$baselineHtml = @"
<section class="baseline">
  <h2>RFQ Baseline</h2>
  <div class="baseline-grid">
    $deadlineHtml
    $specialHtml
    $documentsHtml
    $clarificationsHtml
  </div>
</section>
"@

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
    .baseline { background:var(--panel); border:1px solid var(--line); border-radius:8px; margin-bottom:18px; padding:18px 20px; }
    .baseline h2 { margin:0 0 12px; }
    .baseline-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
    .baseline-card { border:1px solid var(--line); border-radius:7px; padding:12px; background:#fbfcfd; }
    .baseline-card h3 { margin:0 0 8px; font-size:15px; }
    .baseline-card h4,.summary-group h4 { margin:8px 0 4px; font-size:12px; color:var(--muted); text-transform:uppercase; }
    .baseline-card ul,.summary-group ul { margin:0; padding-left:18px; }
    .baseline-card li,.summary-group li { margin:2px 0; }
    .agent-summary { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px 18px; }
    .summary-group:first-child { grid-column:1 / -1; }
    .compact { padding:0; margin:0; }
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
    @media (max-width:760px) { main{padding:14px;} header{padding:14px 16px;} .original-grid,.result-grid,.baseline-grid,.agent-summary{grid-template-columns:1fr;} }
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
    $baselineHtml
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
