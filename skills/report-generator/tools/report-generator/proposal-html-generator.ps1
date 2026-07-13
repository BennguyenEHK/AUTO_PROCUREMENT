param(
  [string]$InputJson,
  [string]$OutputDirectory,
  [ValidateSet('technical','commercial','both')]
  [string]$Mode = 'both',
  [string]$LogoPath,
  [string]$SignaturePath
)

$ErrorActionPreference = 'Stop'

function HtmlEncode([object]$Value) {
  if ($null -eq $Value) { return '' }
  return [System.Net.WebUtility]::HtmlEncode([string]$Value)
}

function AsText([object]$Value, [string]$Fallback = '') {
  if ($null -eq $Value) { return $Fallback }
  if ($Value -is [string] -and [string]::IsNullOrWhiteSpace($Value)) { return $Fallback }
  return [string]$Value
}

function Get-Array($Value) {
  if ($null -eq $Value) { return @() }
  if ($Value -is [System.Array]) { return @($Value) }
  return @($Value)
}

function Format-Money([object]$Value) {
  $n = 0.0
  if ([double]::TryParse([string]$Value, [ref]$n)) {
    return $n.ToString('N0', [System.Globalization.CultureInfo]::GetCultureInfo('vi-VN'))
  }
  return '0'
}

function Resolve-DefaultAssetPath([string]$Kind) {
  $assetRoot = Join-Path (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)) 'assets'
  $folder = if ($Kind -eq 'logo') { Join-Path $assetRoot 'logos' } else { Join-Path $assetRoot 'signatures' }
  if (-not (Test-Path -LiteralPath $folder)) { return '' }

  $supported = @('.png', '.jpg', '.jpeg', '.svg', '.gif')
  $files = Get-ChildItem -LiteralPath $folder -File -ErrorAction SilentlyContinue |
    Where-Object { $supported -contains $_.Extension.ToLowerInvariant() } |
    Sort-Object LastWriteTime -Descending

  $preferredName = if ($Kind -eq 'logo') { 'logo' } else { 'signature' }
  $preferred = @($files | Where-Object { $_.BaseName -ieq $preferredName } | Select-Object -First 1)
  if ($preferred.Count -gt 0) { return $preferred[0].FullName }
  if ($files.Count -gt 0) { return $files[0].FullName }
  return ''
}

function Convert-PathToDataUri([string]$Path) {
  if ([string]::IsNullOrWhiteSpace($Path)) { return '' }
  if ($Path -match '^(https?:|data:)') { return $Path }
  if (-not (Test-Path -LiteralPath $Path)) { return '' }

  $ext = [System.IO.Path]::GetExtension($Path).ToLowerInvariant()
  $mime = switch ($ext) {
    '.jpg' { 'image/jpeg' }
    '.jpeg' { 'image/jpeg' }
    '.png' { 'image/png' }
    '.gif' { 'image/gif' }
    '.svg' { 'image/svg+xml' }
    default { 'application/octet-stream' }
  }
  $bytes = [System.IO.File]::ReadAllBytes((Resolve-Path -LiteralPath $Path).Path)
  return "data:$mime;base64,$([Convert]::ToBase64String($bytes))"
}

function New-EditableCell([string]$Text, [string]$ClassName = '') {
  $safe = HtmlEncode $Text
  return "<td class=`"$ClassName`" contenteditable=`"true`">$safe</td>"
}

function New-ProposalHtml($Data, [string]$ProposalMode, [string]$ResolvedLogo, [string]$ResolvedSignature) {
  $isCommercial = $ProposalMode -eq 'commercial'
  $proposalTitle = if ($isCommercial) { 'COMMERCIAL PROPOSAL' } else { 'TECHNICAL PROPOSAL' }
  $seller = $Data.seller_info
  $customer = $Data.customer_info
  $items = @(Get-Array $Data.quotation_items)
  $currency = AsText $(if ($Data.currency) { $Data.currency } elseif ($Data.transfer_currency_code) { $Data.transfer_currency_code } else { 'VND' }) 'VND'
  $quotationName = AsText $Data.quotation_name $proposalTitle
  $rfqReference = AsText $Data.rfq_reference ''
  $quotationDate = AsText $Data.quotation_date $(Get-Date -Format 'yyyy-MM-dd')
  $quotationId = AsText $Data.quotation_id 'N/A'
  $pageNumber = AsText $Data.page_number '1'
  $commercialTerms = AsText $Data.commercial_terms ''

  $logoSource = if ($ResolvedLogo) { $ResolvedLogo } elseif ($seller.logo_url) { [string]$seller.logo_url } else { '' }
  $signatureSource = if ($ResolvedSignature) { $ResolvedSignature } elseif ($seller.signature_url) { [string]$seller.signature_url } else { '' }

  $logoHtml = if ($logoSource) {
    "<img src=`"$(HtmlEncode $logoSource)`" alt=`"Company logo`">"
  } else {
    '<div class="asset-placeholder" contenteditable="true">Company Logo</div>'
  }

  $signatureHtml = if ($signatureSource) {
    "<img src=`"$(HtmlEncode $signatureSource)`" alt=`"Authorized signature`">"
  } else {
    '<div class="asset-placeholder signature-placeholder" contenteditable="true">Signature</div>'
  }

  $ccLines = (Get-Array $customer.carbon_copy_person | ForEach-Object {
    "<p><strong>Cc:</strong> <span contenteditable=`"true`">$(HtmlEncode (AsText $_))</span></p>"
  }) -join "`n"

  $rowHtml = New-Object System.Collections.Generic.List[string]
  if ($items.Count -eq 0) {
    $colspan = if ($isCommercial) { 8 } else { 6 }
    $rowHtml.Add("<tr><td colspan=`"$colspan`" class=`"empty-row`" contenteditable=`"true`">No items available</td></tr>")
  } else {
    foreach ($item in $items) {
      $companyReq = $item.company_requirement
      $bidder = $item.bidder_proposal
      $itemId = AsText $item.item_id ''
      $companyDescription = AsText $companyReq.company_description ''
      $uom = AsText $companyReq.uom ''
      $qty = AsText $companyReq.qty ''
      $bidderDescription = AsText $bidder.bidder_description ''
      $deliveryTime = AsText $bidder.delivery_time ''

      if ($isCommercial) {
        $unitPrice = Format-Money $item.sales_unit_price
        $extPrice = Format-Money $item.ext_price
        $rowHtml.Add(@"
      <tr>
        $(New-EditableCell $itemId 'item-no-col')
        $(New-EditableCell $companyDescription '')
        $(New-EditableCell $uom '')
        $(New-EditableCell $qty 'number qty-cell')
        $(New-EditableCell $bidderDescription '')
        $(New-EditableCell $unitPrice 'number unit-price-cell price-cell')
        $(New-EditableCell $extPrice 'number ext-price-cell price-cell')
        $(New-EditableCell $deliveryTime '')
      </tr>
"@)
      } else {
        $rowHtml.Add(@"
      <tr>
        $(New-EditableCell $itemId 'item-no-col')
        $(New-EditableCell $companyDescription '')
        $(New-EditableCell $uom '')
        $(New-EditableCell $qty 'number')
        $(New-EditableCell $bidderDescription '')
        $(New-EditableCell $deliveryTime '')
      </tr>
"@)
      }
    }
  }

  $rows = $rowHtml -join "`n"

  if ($isCommercial) {
    $colgroup = @'
        <col style="width:5%">
        <col style="width:22%">
        <col style="width:6%">
        <col style="width:6%">
        <col style="width:25%">
        <col style="width:12%">
        <col style="width:12%">
        <col style="width:12%">
'@
    $headerRows = @"
        <tr>
          <th></th>
          <th colspan="3" class="company-header" contenteditable="true">COMPANY'S REQUIREMENT</th>
          <th colspan="4" class="bidder-header" contenteditable="true">BIDDER'S PROPOSAL</th>
        </tr>
        <tr>
          <th class="item-no-col" contenteditable="true">Item No.</th>
          <th class="company-child" contenteditable="true">Description</th>
          <th class="company-child" contenteditable="true">UOM</th>
          <th class="company-child" contenteditable="true">Qty</th>
          <th class="bidder-child" contenteditable="true">Description</th>
          <th class="bidder-child price-cell" contenteditable="true">Unit price ($currency)</th>
          <th class="bidder-child price-cell" contenteditable="true">Ext. price ($currency)</th>
          <th class="bidder-child" contenteditable="true">Delivery time</th>
        </tr>
"@
    $totalAmount = Format-Money $Data.total_amount
    $footerRows = @"
      <tfoot>
        <tr class="total-row price-row">
          <td colspan="6" class="total-label" contenteditable="true"><strong>SUM (Exclusive of VAT):</strong></td>
          <td class="number" contenteditable="true"><strong>$totalAmount</strong></td>
          <td contenteditable="true"></td>
        </tr>
      </tfoot>
"@
  } else {
    $colgroup = @'
        <col style="width:6%">
        <col style="width:34%">
        <col style="width:8%">
        <col style="width:8%">
        <col style="width:32%">
        <col style="width:12%">
'@
    $headerRows = @'
        <tr>
          <th></th>
          <th colspan="3" class="company-header" contenteditable="true">COMPANY'S REQUIREMENT</th>
          <th colspan="2" class="bidder-header" contenteditable="true">BIDDER'S PROPOSAL</th>
        </tr>
        <tr>
          <th class="item-no-col" contenteditable="true">Item No.</th>
          <th class="company-child" contenteditable="true">Description</th>
          <th class="company-child" contenteditable="true">UOM</th>
          <th class="company-child" contenteditable="true">Qty</th>
          <th class="bidder-child" contenteditable="true">Description</th>
          <th class="bidder-child" contenteditable="true">Delivery time</th>
        </tr>
'@
    $footerRows = ''
  }

  $style = @'
    @page { size: A4 landscape; margin: 10mm; }
    *, *::before, *::after { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    html, body { margin: 0; font-family: "Times New Roman", Times, serif; color: #000; font-size: 12px; line-height: 1.4; background: #f3f5f7; }
    body { padding: 0; }
    .toolbar { position: sticky; top: 0; z-index: 20; display: flex; gap: 6px; align-items: center; flex-wrap: wrap; padding: 8px; background: #263238; color: #fff; font-family: Arial, Helvetica, sans-serif; }
    .toolbar button { border: 1px solid #90a4ae; background: #fff; color: #102027; padding: 5px 8px; border-radius: 4px; cursor: pointer; font: 12px Arial, Helvetica, sans-serif; }
    .toolbar button:hover { background: #e3f2fd; }
    .toolbar .hint { margin-left: auto; color: #d7e3ea; font-size: 11px; }
    .page { background: #fff; width: 277mm; min-height: 190mm; margin: 12px auto; padding: 0; box-shadow: 0 3px 18px rgba(20,30,40,.18); }
    .inner { padding: 0; }
    .top-logo { text-align: center; margin-bottom: 8px; }
    .top-logo img { width: min(250mm, 96%); max-height: 34mm; object-fit: contain; display: inline-block; }
    .asset-placeholder { display: inline-flex; align-items: center; justify-content: center; min-width: 160px; min-height: 60px; border: 1px dashed #777; color: #777; font-style: italic; }
    .company-info-header { text-align: center; margin-bottom: 12px; }
    .company-info-header h3 { margin: 2px 0; font-size: 14px; font-weight: normal; }
    .company-info-header h3 strong { font-weight: bold; }
    .proposal-title { text-align: center; margin: 8px 0; }
    .proposal-title h3 { margin: 4px 0; font-size: 14px; }
    .customer-info { font-size: 13px; line-height: 1.5; margin: 12px 0; position: relative; min-height: 92px; }
    .customer-info p { margin: 2px 0; }
    .customer-info .company-name { font-weight: bold; font-size: 15px; }
    .customer-info .address { font-style: italic; font-weight: 600; }
    .doc-metadata { position: absolute; top: 0; right: 0; text-align: right; font-size: 12px; line-height: 1.4; }
    .doc-metadata p { margin: 2px 0; }
    .subject-line { font-weight: bold; margin: 8px 0; }
    .scope-title { text-align: left; font-weight: bold; padding: 6px 0; margin: 8px 0 4px; }
    .quotation-table { width: 100%; border-collapse: collapse; table-layout: fixed; margin-bottom: 12px; }
    .quotation-table th, .quotation-table td { border: 1px solid #000; padding: 6px 8px; vertical-align: top; word-break: break-word; overflow-wrap: anywhere; text-align: left; min-height: 22px; }
    .quotation-table thead { display: table-header-group; }
    .quotation-table tbody tr:nth-child(even) td { background-color: #fafafa; }
    .quotation-table .item-no-col { background-color: #f0f0f0; font-weight: bold; text-align: center; }
    .quotation-table .company-header, .quotation-table .company-child { background-color: #f9d7c2; text-align: center; font-weight: bold; }
    .quotation-table .bidder-header, .quotation-table .bidder-child { background-color: #d9ead3; text-align: center; font-weight: bold; }
    .quotation-table .total-row td { background-color: #f9f9f9; font-weight: bold; }
    .quotation-table .number { text-align: right; }
    .footer { margin-top: 16px; }
    .footer h4 { font-weight: bold; margin: 8px 0; }
    .signature-section { margin-top: 24px; text-align: right; }
    .signature-section img { max-height: 38mm; max-width: 72mm; object-fit: contain; }
    .signature-placeholder { min-width: 140px; min-height: 52px; }
    [contenteditable="true"]:focus { outline: 2px solid #1565c0; outline-offset: -2px; background: #eaf4ff !important; }
    td.selected, th.selected { box-shadow: inset 0 0 0 2px #1565c0; }
    .print-note { max-width: 277mm; margin: 10px auto; color: #33524a; font: 12px Arial, Helvetica, sans-serif; text-align: center; }
    @media print { html, body, .page, .inner { background: #fff !important; } .toolbar, .print-note { display: none !important; } .page { width: auto; min-height: auto; margin: 0; box-shadow: none; } }
'@

  $script = @'
    let selectedCell = null;
    function printOrSavePdf() {
      const note = document.getElementById('print-note');
      if (note) note.textContent = 'Opening the browser print dialog. Choose Save as PDF and select your preferred folder in the browser dialog.';
      setTimeout(function () {
        try {
          window.focus();
          window.print();
        } catch (error) {
          if (note) note.textContent = 'This browser did not allow the print dialog. Open this HTML in Microsoft Edge/Chrome and press Ctrl+P, then choose where to save the PDF.';
        }
      }, 50);
    }
    document.addEventListener('click', function (event) {
      const cell = event.target.closest('td, th');
      if (!cell) return;
      if (selectedCell) selectedCell.classList.remove('selected');
      selectedCell = cell;
      selectedCell.classList.add('selected');
    });
    function table() { return document.getElementById('quotationTable'); }
    function selectedIndex() { return selectedCell ? selectedCell.cellIndex : 0; }
    function addRow() {
      const body = table().tBodies[0];
      const colCount = table().rows[table().rows.length - 1].cells.length || 1;
      const row = body.insertRow(selectedCell && selectedCell.parentElement.parentElement === body ? selectedCell.parentElement.rowIndex - table().tHead.rows.length + 1 : body.rows.length);
      for (let i = 0; i < colCount; i++) {
        const cell = row.insertCell(i);
        cell.contentEditable = 'true';
        cell.textContent = '';
        if (i === 0) cell.className = 'item-no-col';
      }
    }
    function removeRow() {
      if (!selectedCell) return;
      const row = selectedCell.parentElement;
      if (row.parentElement.tagName.toLowerCase() === 'tbody' && table().tBodies[0].rows.length > 1) row.remove();
    }
    function addColumn() {
      const idx = selectedIndex() + 1;
      Array.from(table().rows).forEach(function (row) {
        const cell = row.insertCell(Math.min(idx, row.cells.length));
        cell.contentEditable = 'true';
        cell.textContent = '';
      });
    }
    function removeColumn() {
      if (!selectedCell) return;
      const idx = selectedIndex();
      Array.from(table().rows).forEach(function (row) {
        if (row.cells.length > idx && row.cells.length > 1) row.deleteCell(idx);
      });
      selectedCell = null;
    }
    function toNumber(text) {
      const n = Number(String(text || '').replace(/[^\d.-]/g, ''));
      return Number.isFinite(n) ? n : 0;
    }
    function fmt(n) { return Math.round(n).toLocaleString('vi-VN'); }
    function recalcCommercial() {
      const rows = Array.from(table().tBodies[0].rows);
      let total = 0;
      rows.forEach(function (row) {
        if (row.cells.length < 8) return;
        const qty = toNumber(row.cells[3].innerText);
        const unit = toNumber(row.cells[5].innerText);
        const ext = qty * unit;
        row.cells[6].innerText = fmt(ext);
        total += ext;
      });
      const totalCell = document.querySelector('.total-row td:nth-child(2)');
      if (totalCell) totalCell.innerText = fmt(total);
    }
    function saveHtml() {
      const clone = document.documentElement.cloneNode(true);
      const toolbar = clone.querySelector('.toolbar');
      if (toolbar) toolbar.remove();
      clone.querySelectorAll('.selected').forEach(function (el) { el.classList.remove('selected'); });
      const html = '<!doctype html>\n' + clone.outerHTML;
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = document.title.replace(/[^\w.-]+/g, '_') + '.html';
      a.click();
      URL.revokeObjectURL(url);
    }
'@

  $html = @"
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>$(HtmlEncode $quotationName) - $proposalTitle</title>
  <style>
$style
  </style>
</head>
<body data-proposal-mode="$ProposalMode">
  <div class="toolbar">
    <button type="button" onclick="addRow()">Add row</button>
    <button type="button" onclick="removeRow()">Remove row</button>
    <button type="button" onclick="addColumn()">Add column</button>
    <button type="button" onclick="removeColumn()">Remove column</button>
    <button type="button" onclick="recalcCommercial()">Recalculate</button>
    <button type="button" onclick="printOrSavePdf()">Print / Save PDF</button>
    <button type="button" onclick="saveHtml()">Save HTML</button>
    <span class="hint">Click a cell, then edit. Use Print / Save PDF to choose a PDF destination in your browser.</span>
  </div>
  <div id="print-note" class="print-note">PDF files are not generated automatically. Use Print / Save PDF and choose the save location in your browser.</div>
  <div class="page">
    <div class="inner">
      <div class="top-logo">$logoHtml</div>
      <div class="company-info-header">
        <h3><strong contenteditable="true">$(HtmlEncode (AsText $seller.company_name))</strong></h3>
        <h3 contenteditable="true">$(HtmlEncode (AsText $seller.address))</h3>
        <h3><strong>Tel:</strong> <span contenteditable="true">$(HtmlEncode (AsText $seller.tel))</span> &nbsp;&nbsp; <strong>Fax:</strong> <span contenteditable="true">$(HtmlEncode (AsText $seller.fax_number))</span></h3>
      </div>

      <div class="proposal-title">
        <h3><strong contenteditable="true">$proposalTitle</strong></h3>
        <p><strong>RFQ Reference: </strong><span contenteditable="true">$(HtmlEncode $rfqReference)</span></p>
      </div>

      <div class="customer-info">
        <p><strong>To:</strong> <span class="company-name" contenteditable="true">$(HtmlEncode (AsText $customer.company_name))</span></p>
        <p class="address" contenteditable="true">$(HtmlEncode (AsText $customer.customer_address))</p>
        <p><strong>Tel:</strong> <span contenteditable="true">$(HtmlEncode (AsText $customer.tel))</span> &nbsp;&nbsp;&nbsp;&nbsp; <strong>Fax:</strong> <span contenteditable="true">$(HtmlEncode (AsText $customer.fax_number))</span></p>
        <br>
        <p><strong>Attn:</strong> <span contenteditable="true">$(HtmlEncode (AsText $customer.attention_person))</span></p>
        $ccLines
        <div class="doc-metadata">
          <p>Quotation No.: <span contenteditable="true">$(HtmlEncode $quotationId)</span></p>
          <p contenteditable="true">$(HtmlEncode $quotationDate)</p>
          <p>Page: <span contenteditable="true">$(HtmlEncode $pageNumber)</span></p>
        </div>
      </div>

      <p class="subject-line">Subj: <span contenteditable="true">$(HtmlEncode $rfqReference)</span></p>
      <h4 class="scope-title" contenteditable="true">I.&nbsp;&nbsp;SCOPE OF SUPPLY</h4>

      <table id="quotationTable" class="quotation-table">
        <colgroup>
$colgroup
        </colgroup>
        <thead>
$headerRows
        </thead>
        <tbody>
$rows
        </tbody>
$footerRows
      </table>

      <div class="footer">
        <h4 contenteditable="true">II.&nbsp;&nbsp;TERMS AND CONDITIONS</h4>
        <p contenteditable="true">$(HtmlEncode $commercialTerms)</p>
      </div>

      <div class="signature-section">
        <p><strong contenteditable="true">Authorized by:</strong></p>
        <div style="margin:20px 0; width:200px; display:inline-block;">$signatureHtml</div>
      </div>
    </div>
  </div>
  <script>
$script
  </script>
</body>
</html>
"@

  return $html
}

if ($InputJson) {
  $jsonText = Get-Content -Raw -LiteralPath $InputJson
} else {
  $jsonText = [Console]::In.ReadToEnd()
}

if ([string]::IsNullOrWhiteSpace($jsonText)) {
  throw 'No JSON input was provided. Pass -InputJson or pipe JSON to stdin.'
}

$data = $jsonText | ConvertFrom-Json

if (-not $OutputDirectory) {
  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $OutputDirectory = Join-Path $PSScriptRoot "output\proposal\proposal-$stamp"
}
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null

$resolvedLogoPath = if ($LogoPath) { $LogoPath } else { Resolve-DefaultAssetPath 'logo' }
$resolvedSignaturePath = if ($SignaturePath) { $SignaturePath } else { Resolve-DefaultAssetPath 'signature' }

$logoData = Convert-PathToDataUri $resolvedLogoPath
$signatureData = Convert-PathToDataUri $resolvedSignaturePath

$modes = if ($Mode -eq 'both') { @('technical','commercial') } else { @($Mode) }
$results = New-Object System.Collections.Generic.List[object]

foreach ($proposalMode in $modes) {
  $html = New-ProposalHtml -Data $data -ProposalMode $proposalMode -ResolvedLogo $logoData -ResolvedSignature $signatureData
  $htmlPath = Join-Path $OutputDirectory "$proposalMode-proposal-editable.html"
  [System.IO.File]::WriteAllText($htmlPath, $html, (New-Object System.Text.UTF8Encoding($false)))


  $results.Add([pscustomobject]@{
    mode = $proposalMode
    html_path = (Resolve-Path -LiteralPath $htmlPath).Path
  })
}

[pscustomobject]@{
  success = $true
  output_directory = (Resolve-Path -LiteralPath $OutputDirectory).Path
  logo_path = if ($resolvedLogoPath) { $resolvedLogoPath } else { $null }
  signature_path = if ($resolvedSignaturePath) { $resolvedSignaturePath } else { $null }
  results = $results
} | ConvertTo-Json -Depth 8
