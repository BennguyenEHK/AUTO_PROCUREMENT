---
name: report-generator
description: Route QuoteFlow report, pricing, and proposal review to canonical web-app deep links, and generate standalone artifacts only when a customer explicitly requires them.
---

# Report Generator
## Local Artifact Links

When returning local artifacts, first verify the exact output file exists and is non-empty. Resolve the actual absolute Windows path; for HTML/report previews provide a browser-safe `file:///C:/...` or `file:///D:/...` URL plus the Windows path. Never return placeholder, relative, stale, `/mnt/c/...`, or `C:/mnt/c/...` links.

When generating an HTML report on behalf of another skill, save the file in that owning skill's `output` folder by passing an explicit `-OutputPath`. For the reply-impact specialist skills, use:

- `C:\Users\LENOVO\.codex\skills\supplier-quotation-normalizer\output`
- `C:\Users\LENOVO\.codex\skills\technical-compliance-review\output`
- `C:\Users\LENOVO\.codex\skills\certificate-origin-review\output`

Return both the verified Windows path and a Codex-openable `file:///C:/...` preview link. Do not return a link until the file exists and is non-empty.

When editing this `SKILL.md` or report-generator Markdown/control files, preserve UTF-8 without BOM and verify no BOM after edits when practical.

## Purpose

Use this skill to create reusable procurement reporting artifacts without making the model hand-generate long HTML layouts each run.

## Canonical Web App Links

Use `http://localhost:3000/?view=documents&tab=quotes&rfqId=<id>` for quotes, `http://localhost:3000/?view=documents&tab=technical&rfqId=<id>` for technical review, `http://localhost:3000/?view=pricing&rfqId=<id>` for pricing, and `http://localhost:3000/?view=proposal&rfqId=<id>` for proposals.

Do not generate or open standalone HTML for normal workflow review. Generate a standalone artifact only where the customer explicitly requires it, and verify its path before returning it.

Primary outputs:

- Customer-required Response Impact HTML using `tools/report-generator/form-generator.ps1 -Mode response-impact`.
- Customer-required native editable Technical Proposal HTML using `tools/report-generator/proposal-html-generator.ps1`.
- Customer-required native editable Commercial Proposal HTML using `tools/report-generator/proposal-html-generator.ps1`.

For normal technical/commercial proposal review, return the canonical proposal deep link. Do not auto-create a PDF; when a customer explicitly requires a standalone proposal, generate only the required artifact.

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
- `supplier_item_status`: `rfq_id`, `item_id`, `supplier_name`, `bidder_description`, `contact_email`, `contact_phone`, `social_contact`, `bidder_unit_price`, `currency_code`, `delivery_time`, `available_qty`, `selling_unit`, `pack_size`, `manufacturer`, `item_origin`, `compliance_deviation`, `match_reasoning`, `evidence`, `company_id`, `user_id`.
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

## Customer-Required RFQ Analysis HTML

Use this mode only when the customer explicitly requires a standalone RFQ Analysis HTML artifact. Otherwise, use the canonical technical deep link before `$bid-package-orchestrator` advances to `$suppliers-search`.

The RFQ-analysis report is a user-validation gate. It must be readable enough for the user to approve or correct:

- customer company/contact information;
- deadline / closing / delivery timing;
- RFQ requirement summary;
- special or further requirements;
- required documents and certificates;
- clarifications or missing information;
- extracted item descriptions, quantities, UOM, and functional summaries.

Normalize RFQ analysis data to:

```json
{
  "generated_at": "2026-07-14",
  "rfq_id": 1,
  "company_id": 1,
  "user_id": 1,
  "customer_info": {
    "company_name": "Customer",
    "customer_address": "Address",
    "attention_person": "Attn",
    "email": "customer@example.com",
    "phone": "Phone",
    "fax_number": "Fax",
    "carbon_copy_person": []
  },
  "rfq_analysis": {
    "rfq_reference": "RFQ-001",
    "subject": "RFQ Analysis - title",
    "analysis_content": "2-5 sentence summary",
    "required_currency": "VND",
    "deadline": "Quotation deadline / closing time / delivery deadline when known",
    "deadline_period": "45 days",
    "closing_time": "2026-07-14T12:00:00Z",
    "special_requirements": {},
    "required_documents": {},
    "clarifications": []
  },
  "items": [
    {
      "item_id": 1,
      "company_description": "exact original description",
      "qty": "1",
      "uom": "EA",
      "agent_item_summary": {}
    }
  ]
}
```

Run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:\Users\LENOVO\.codex\skills\report-generator\tools\report-generator\form-generator.ps1 `
  -Mode rfq-analysis `
  -InputJson C:\path\to\rfq-analysis-review.json
```

Default output folder:

```text
C:\Users\LENOVO\.codex\skills\report-generator\tools\report-generator\output\rfq-analysis
```

The RFQ-analysis report must not include supplier cards, supplier links, match scores, supplier pricing, supplier images, or supplier-search terminology.

## Customer-Required Supplier Search HTML

Only when the customer explicitly requires a standalone supplier-search HTML artifact, normalize Neon rows or fresh supplier-search JSON to:

```json
{
  "generated_at": "2026-07-09",
  "rfq_id": 1,
  "company_id": 1,
  "user_id": 1,
  "rfq_analysis": {
    "deadline": "Quotation deadline / closing time / delivery deadline when known",
    "deadline_period": "45 days",
    "closing_time": "2026-07-14T12:00:00Z",
    "special_requirements": {
      "coo_origin": ["country of origin restrictions or declarations"],
      "certificates": ["certificate requirements"],
      "standards": ["technical standards"],
      "inspection": ["inspection or test requirements"],
      "documentation": ["datasheets, manuals, QA documents"],
      "manufacturer_authorization": ["authorization or OEM/distributor requirements"],
      "incoterms": ["Incoterms"],
      "currency": ["required quotation currency"],
      "validity": ["quotation validity"],
      "payment_terms": ["payment terms"],
      "bid_bonds": ["bid bond requirements"],
      "technical_commercial_forms": ["technical/commercial bid forms"],
      "commercial": ["Incoterms, currency, validity, payment terms"],
      "technical": ["standards, inspection, manufacturer authorization"],
      "submission": ["technical/commercial forms, bid bonds"],
      "compliance": ["COO/origin, certificates, documentation"]
    },
    "required_documents": {
      "certificates": ["COO, CoC, CQ, calibration, hydrotest, MTR"],
      "bid_documents": ["technical proposal, commercial proposal, forms"],
      "shipping_documents": [],
      "invoice_backup": []
    },
    "clarifications": []
  },
  "items": [
    {
      "item_id": 1,
      "company_description": "exact original description",
      "qty": "1",
      "uom": "EA",
      "agent_item_summary": {},
      "images": [{ "url": "https://...", "caption": "..." }],
      "suppliers": [
        {
          "supplier_name": "verified supplier",
          "manufacturer": "verified manufacturer when known",
          "source_url": "https://...",
          "contact_email": "sales@example.com",
          "contact_phone": "+84...",
          "social_contact": "WhatsApp/contact form/LinkedIn when visible",
          "bidder_unit_price": 0,
          "currency_code": "USD",
          "delivery_time": "stock/lead time text",
          "available_qty": 10,
          "selling_unit": "EA",
          "pack_size": 1,
          "other_information": "concise source-supported supplier/product notes",
          "match_type": "exact_match",
          "match_score": 90,
          "match_reason": "why this source matches",
          "technical_differences": "None",
          "alternative_reason": ""
        }
      ]
    }
  ]
}
```

The supplier-search report must render RFQ baseline data as separate readable sections before item cards:

- deadline / closing / delivery timing;
- special or further requirements, separated where available into COO/origin, certificates, standards, inspection, documentation, manufacturer authorization, Incoterms, currency, validity, payment terms, bid bonds, technical/commercial forms, commercial, technical, submission, and compliance;
- required documents and certificates;
- clarifications or missing information.

The generator must render `agent_item_summary` as procurement-readable text, not raw JSON. When the summary has `identification`, `classification`, `application`, `purpose`, and `features`, show those as labeled sections or bullet lists.

For supplier cards, render source-supported contact and commercial fields when present: `contact_email`, `contact_phone`, `social_contact`, `bidder_unit_price`, `currency_code`, `delivery_time`, `available_qty`, `selling_unit`, and `pack_size`. Do not display unknown values as invented defaults; omit or label them as not found.

Run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:\Users\LENOVO\.codex\skills\report-generator\tools\report-generator\form-generator.ps1 `
  -InputJson C:\path\to\supplier-search.json
```

Default output folder:

```text
C:\Users\LENOVO\.codex\skills\report-generator\tools\report-generator\output\search
```

## Response Impact HTML

Use this mode after `$bid-package-orchestrator` processes a meaningful customer/supplier/OEM/manufacturer/distributor reply. The report is the user-facing proof that the reply was checked against the workflow and that only affected specialist stages were run.

Normalize response-impact data to:

```json
{
  "generated_at": "2026-07-15",
  "rfq_id": 1,
  "rfq_reference": "PRD-25-PR-10337",
  "response_source": {
    "party_type": "supplier",
    "subject": "RFQ - PRD-25-PR-10337",
    "message_date": "2026-07-15",
    "source_reference": "Gmail thread / file / attachment"
  },
  "prior_checkpoint": "supplier_search",
  "routing_decision": {
    "meaningful_bid_impact": true,
    "skills_called": ["supplier-quotation-normalizer", "technical-compliance-review"],
    "skills_skipped": ["certificate-origin-review"],
    "reason": "Supplier revised offer changed price and offered model; no certificate/origin change."
  },
  "affected_items": [
    { "item_id": 1, "fields": ["price", "model"], "impact": "technical and commercial basis changed" }
  ],
  "supplier_quote_normalization": {},
  "technical_compliance_impact": {},
  "certificate_origin_document_impact": {},
  "numerical_proof": [],
  "blockers": [],
  "next_required_action": "continue to commercial_pricing",
  "recommendation": "continue"
}
```

The HTML report must render separate sections for:

- response source and prior checkpoint;
- affected items, fields, stages, and documents;
- routing decision, skills called, and skills intentionally skipped;
- Supplier Quote Normalization Result when called;
- Technical Compliance Impact when called;
- Certificate / Origin / Document Impact when called;
- Numerical Proof Appendix with calculation method and graph/table proof when material numbers are involved;
- blockers and next required action;
- recommendation: continue, block, ask supplier, ask customer, rerun pricing, revisit selected offer, regenerate forms, or rerun QA.

Do not collapse specialist findings into one untraceable paragraph. Preserve each specialist conclusion, source evidence, persistence status, and blocker status.

Run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:\Users\LENOVO\.codex\skills\report-generator\tools\report-generator\form-generator.ps1 `
  -Mode response-impact `
  -InputJson C:\path\to\response-impact.json
```

Default output folder:

```text
C:\Users\LENOVO\.codex\skills\report-generator\tools\report-generator\output\response-impact
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
- For customer-required RFQ-analysis reports, verify the generated HTML title is `RFQ Analysis Report`, baseline sections render, customer info renders when provided, extracted items render, and no supplier cards, match scores, supplier prices, or supplier-search results appear.
- For customer-required supplier-search reports, verify the generated HTML title is `Supplier Search Report`, RFQ baseline sections render when provided, supplier cards render, source-supported contact/commercial fields render when provided, and structured `agent_item_summary` is readable rather than raw JSON.
- For response-impact reports, verify the generated HTML title is `Response Impact Report`, routing decision renders, called/skipped skills render, each called specialist section renders separately, blockers and next action render, and numerical proof appears when provided.
- Verify proposal JSON for final customer-facing output was built from re-read `selected_offers` rows when that table exists.
- Verify generated HTML exists and is non-empty.
- For a customer-required standalone artifact, verify any returned preview link points to the actual generated output path and opens through a browser-safe `file:///C:/...` or `file:///D:/...` URL.
- Verify technical HTML has no visible unit price, extended price, subtotal, VAT, or total amount columns/rows.
- Verify commercial HTML includes unit price, extended price, and total amount.
- Verify commercial HTML is generated only from approved and persisted pricing; otherwise report the missing pricing approval and do not present it as final.
- Verify cells are editable and add/remove row/column JavaScript exists.
- Verify company logo is loaded from `assets\logos` and centered at the top, or a visible placeholder exists when no logo asset is available.
- Verify authorized signature is loaded from `assets\signatures`, or a visible placeholder exists when no signature asset is available.
- Report missing database fields, missing selected supplier text, missing pricing, missing logo/signature assets, or missing browser PDF support honestly.

## Final Response

Return only the useful artifact links plus a short status:

- The applicable canonical web-app deep link for normal workflow review.
- A verified path and browser-safe `file:///...` link only for a customer-required standalone artifact.
- Database tables used.
- Missing data or assumptions.

Do not include long embedded HTML, full JSON, or raw database rows in chat unless the user explicitly asks.
