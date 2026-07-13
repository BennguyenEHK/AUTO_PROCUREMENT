---
name: report-generator
description: Generate procurement reports, searchable supplier-search HTML reports, and native editable technical/commercial quotation proposal HTML files for QuoteFlow. Use when Codex needs to turn Neon or fresh procurement JSON into report.html, create customer-facing technical or commercial supplier proposal HTML documents from QuoteFlow quotation data, run the native Windows proposal-html-generator.ps1 path, remove all price columns/totals from technical proposals, include full pricing in commercial proposals, or avoid PDF/Excel/document plugins for proposal generation.
---

# Report Generator
## Local Artifact Links

When returning local artifacts, resolve the actual absolute Windows path; use Windows links (and browser-safe `file:///C:/...` for HTML), never `/mnt/c/...` or `C:/mnt/c/...`.

## Purpose

Use this skill to create reusable procurement reporting artifacts without making the model hand-generate long HTML layouts each run.

Primary outputs:

- Supplier-search HTML report from JSON using `tools/report-generator/form-generator.ps1`.
- Native editable Technical Proposal HTML using `tools/report-generator/proposal-html-generator.ps1`.
- Native editable Commercial Proposal HTML using `tools/report-generator/proposal-html-generator.ps1`.

Do not use spreadsheet, document, or PDF plugins for the technical/commercial quotation proposal generation path. Use native Windows PowerShell to generate editable HTML only. Do not auto-create PDF files; users create PDFs manually from the HTML browser Print / Save PDF dialog and choose their own save location.

## Required Preflight

Before generating from database data:

1. Use `$quoteflow-neon` on project `quoteflow_ai`, database `neondb`, main branch `br-soft-smoke-ahc5mcj6`.
2. Inspect live schemas for every table used.
3. Fetch only the RFQ/customer/company/quotation/pricing scope requested by the user.
4. Preserve source IDs: `rfq_id`, `quotation_id`, `item_id`, `customer_id`, `company_id`, and `user_id`.
5. For commercial proposals, confirm pricing has been approved through `comercial-pricing` and persisted before building customer-facing priced JSON. If approval cannot be verified, generate technical-only output or clearly block commercial generation as draft/unapproved.
6. Build the proposal JSON locally, then pass it to the native generator. The generator must not connect directly to Neon.

Live schema confirmed for this proposal path:

- `rfq_analysis`: `rfq_id`, `company_id`, `user_id`, `rfq_reference`, `subject`, `required_currency`, `special_requirements`, `required_documents`, `clarifications`.
- `rfq_items`: `rfq_id`, `item_id`, `company_description`, `qty`, `uom`, `agent_item_summary`, `company_id`, `user_id`.
- `customers`: `rfq_id`, `customer_id`, `company_name`, `customer_address`, `phone`, `fax_number`, `attention_person`, `carbon_copy_person`, `email`, `company_id`, `user_id`.
- `user_company`: `company_id`, `company_name`, `company_number`, `company_address`, `company_fax`, `company_email`.
- `quotations`: `quotation_id`, `rfq_id`, `quotation_name`, `version_number`, `generated_day`, `total_amount`, `transfer_currency_code`, `commercial_terms`, `company_id`, `user_id`.
- `quotation_pricing`: `quotation_id`, `item_id`, `sales_unit_price`, `ext_price`, `tax_rate`, `exchange_currency`, `shipping_cost`, `discount_rate`, `profit_rate`, `exchange_rate`, `company_id`, `user_id`.
- `supplier_item_status`: `rfq_id`, `item_id`, `supplier_name`, `bidder_description`, `bidder_unit_price`, `delivery_time`, `currency_code`, `manufacturer`, `item_origin`, `compliance_deviation`, `evidence`, `company_id`, `user_id`.
- `selected_offers`: preferred source for final proposal rows when available, including `rfq_id`, `item_id`, selected supplier/manufacturer/model/P/N/description, qty, UOM, country of origin, lead time, certificates, technical/deviation status, final selling prices, currency, approval status, and `frozen_at`.
- `file_metadata`: optional asset storage with `file_image`, `file_html`, `file_category`, `rfq_id`, `quotation_id`, `company_id`, `user_id`. Do not assume it contains a usable logo or signature unless live rows prove it.

Canonical branding assets live inside this skill folder:

- `C:\Users\LENOVO\.codex\skills\report-generator\assets\logos`
- `C:\Users\LENOVO\.codex\skills\report-generator\assets\signatures`

The native proposal generator automatically uses the newest supported image from those folders when `-LogoPath` or `-SignaturePath` is not supplied. Prefer canonical files named `logo.png`, `logo.jpg`, `logo.svg`, `signature.png`, `signature.jpg`, or `signature.svg` when available. If assets are unavailable, generate visible editable placeholders and report the missing assets.

## Proposal JSON Shape

Build this JSON before running the native generator:

```json
{
  "quotation_name": "Commercial Proposal",
  "quotation_id": 1,
  "quotation_date": "2026-07-12",
  "page_number": "1",
  "rfq_reference": "RFQ-001",
  "currency": "VND",
  "total_amount": 0,
  "commercial_terms": "Delivery and validity terms",
  "seller_info": {
    "company_name": "Seller",
    "address": "Seller address",
    "tel": "Phone or company number",
    "fax_number": "Fax",
    "logo_url": "",
    "signature_url": ""
  },
  "customer_info": {
    "company_name": "Customer",
    "customer_address": "Address",
    "tel": "Phone",
    "fax_number": "Fax",
    "attention_person": "Attn",
    "carbon_copy_person": []
  },
  "quotation_items": [
    {
      "item_id": 1,
      "company_requirement": {
        "company_description": "Customer description",
        "uom": "EA",
        "qty": 1
      },
      "bidder_proposal": {
        "bidder_description": "Offered description",
        "delivery_time": "4 weeks"
      },
      "sales_unit_price": 0,
      "ext_price": 0
    }
  ]
}
```

Field mapping:

- `seller_info.company_name` <- `user_company.company_name`.
- `seller_info.address` <- `user_company.company_address`.
- `seller_info.tel` <- `user_company.company_number` or `user_company.company_email` fallback if no telephone exists.
- `seller_info.fax_number` <- `user_company.company_fax`.
- `customer_info.company_name` <- `customers.company_name`.
- `customer_info.customer_address` <- `customers.customer_address`.
- `customer_info.tel` <- `customers.phone`.
- `customer_info.fax_number` <- `customers.fax_number`.
- `customer_info.attention_person` <- `customers.attention_person`.
- `customer_info.carbon_copy_person` <- `customers.carbon_copy_person`.
- `rfq_reference` <- `rfq_analysis.rfq_reference`, with `subject` fallback.
- `currency` <- `quotations.transfer_currency_code`, then `rfq_analysis.required_currency`, then `quotation_pricing.exchange_currency`, then supplier `currency_code`, then `VND`.
- `quotation_date` <- `quotations.generated_day`, with current date fallback.
- `commercial_terms` <- `quotations.commercial_terms`.
- `quotation_items[].item_id` <- `rfq_items.item_id`.
- `quotation_items[].company_requirement.company_description` <- `rfq_items.company_description`.
- `quotation_items[].company_requirement.qty` <- `rfq_items.qty`.
- `quotation_items[].company_requirement.uom` <- `rfq_items.uom`.
- `quotation_items[].bidder_proposal.bidder_description` <- re-read `selected_offers.selected_description` when available; fallback to selected/approved `supplier_item_status.bidder_description`; fallback to `rfq_items.agent_item_summary` only when no selected supplier text exists.
- `quotation_items[].bidder_proposal.delivery_time` <- re-read `selected_offers.lead_time` when available; fallback to selected/approved `supplier_item_status.delivery_time`.
- `quotation_items[].sales_unit_price` <- `quotation_pricing.sales_unit_price`.
- `quotation_items[].ext_price` <- `quotation_pricing.ext_price`, cross-checked against quantity and unit price.
- `total_amount` <- `quotations.total_amount`, cross-checked against `sum(quotation_pricing.ext_price)`.

## Native Proposal Generator

Run on native Windows:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:\Users\LENOVO\.codex\skills\report-generator\tools\report-generator\proposal-html-generator.ps1 `
  -InputJson C:\path\to\proposal-data.json `
  -OutputDirectory C:\path\to\output\proposal `
  -Mode both
```

By default, the generator resolves branding assets from the canonical `assets\logos` and `assets\signatures` folders. Use `-LogoPath` or `-SignaturePath` only for a one-off override.

Modes:

- `technical`: create `technical-proposal-editable.html` only.
- `commercial`: create `commercial-proposal-editable.html` only.
- `both`: create both technical and commercial editable HTML outputs.

The editable HTML must include JavaScript controls for row and column changes:

- add row;
- remove selected row;
- add column;
- remove selected column;
- recalculate commercial extended prices and total;
- browser print/save PDF button that lets the user choose the PDF save location;
- save edited HTML.

The toolbar must be hidden in print/PDF. Every visible cell in the proposal body must be editable with `contenteditable="true"` or an equivalent editable control.

## Technical Proposal Rules

Use when the output is a technical offer without commercial prices.

Required behavior:

- Title: `TECHNICAL PROPOSAL`.
- Same header/customer/RFQ layout as commercial.
- Company logo is top centered above company text, not top-left.
- Table includes item number, customer description, UOM, quantity, bidder description, and delivery time.
- No unit price column.
- No extended price column.
- No total amount, VAT, subtotal, or commercial pricing row.
- No supplier purchase cost, internal margin, potential profit, or internal pricing audit fields.
- If terms include explicit pricing/payment content, flag for review before including in the technical version.

## Commercial Proposal Rules

Use when the output is a priced quotation.

Required behavior:

- Title: `COMMERCIAL PROPOSAL`.
- Same header/customer/RFQ layout as technical.
- Company logo is top centered above company text, not top-left.
- Table includes unit price and extended price.
- Include `SUM (Exclusive of VAT)` or approved total wording.
- Include commercial terms, currency, delivery, and validity when available.
- Use `quotation_pricing.sales_unit_price`, `quotation_pricing.ext_price`, and `quotations.total_amount` as customer-facing values only after pricing is approved through the `comercial-pricing` pricing canvas/review packet or explicit direct-pricing approval.
- Never expose `potential_profit`, `profit_rate`, internal supplier cost, internal margins, or internal calculation notes in customer-facing outputs.

## Supplier Search HTML

Input can come from Neon rows or fresh supplier-search JSON. Normalize it to:

```json
{
  "generated_at": "2026-07-09",
  "rfq_id": 1,
  "company_id": 1,
  "user_id": 1,
  "items": [
    {
      "item_id": 1,
      "company_description": "exact original description",
      "qty": "1",
      "uom": "EA",
      "agent_item_summary": {},
      "images": [{ "url": "https://...", "caption": "..." }],
      "suppliers": []
    }
  ]
}
```

Run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:\Users\LENOVO\.codex\skills\report-generator\tools\report-generator\form-generator.ps1 `
  -InputJson C:\path\to\supplier-search.json
```

Default output folder:

```text
C:\Users\LENOVO\.codex\skills\report-generator\tools\report-generator\output\search
```

## Design Rules

Apply `$frontend-design` for editable proposal HTML:

- procurement document, not a web landing page;
- quiet A4 landscape layout with dense readable tables;
- Times New Roman document body to match the reference files;
- restrained company/customer header;
- top-centered logo as the first visual signal;
- clear group coloring for customer requirement and bidder proposal columns;
- visible keyboard focus on editable cells;
- toolbar that supports editing but disappears in print/PDF.

## Validation

Before final response:

- Verify input JSON parsed successfully.
- Verify proposal JSON for final customer-facing output was built from re-read `selected_offers` rows when that table exists.
- Verify generated HTML exists and is non-empty.
- Verify technical HTML has no visible unit price, extended price, subtotal, VAT, or total amount columns/rows.
- Verify commercial HTML includes unit price, extended price, and total amount.
- Verify commercial HTML is generated only from approved and persisted pricing; otherwise report the missing pricing approval and do not present it as final.
- Verify cells are editable and add/remove row/column JavaScript exists.
- Verify company logo is loaded from `assets\logos` and centered at the top, or a visible placeholder exists when no logo asset is available.
- Verify authorized signature is loaded from `assets\signatures`, or a visible placeholder exists when no signature asset is available.
- Report missing database fields, missing selected supplier text, missing pricing, missing logo/signature assets, or missing browser PDF support honestly.

## Final Response

Return only the useful artifact links plus a short status:

- Technical editable HTML path.
- Commercial editable HTML path.
- Database tables used.
- Missing data or assumptions.

Do not include long embedded HTML, full JSON, or raw database rows in chat unless the user explicitly asks.
