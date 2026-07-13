# QuoteFlow Native HTML Proposal Pattern

This reference summarizes the native editable HTML proposal generator based on:

- `D:\dev\quoteflow_ai\lib\services\quotation\build-print-html.ts`
- `D:\dev\quoteflow_ai\components\app\workboard\panels\preview\quotation-document.tsx`

## Shared Layout

- A4 landscape print target.
- Top-centered company logo above company information.
- Company name, address, phone/company number, and fax centered below the logo.
- Proposal title and RFQ reference centered.
- Customer block on the left with quotation metadata on the right.
- `I. SCOPE OF SUPPLY` table with grouped headers:
  - `COMPANY'S REQUIREMENT`
  - `BIDDER'S PROPOSAL`
- Terms and conditions below the table.
- Signature block near the lower right.
- Toolbar exists in editable HTML and is hidden when the user prints or saves to PDF from the browser.

## Editable HTML Requirements

Every visible proposal cell must be editable. The generated HTML must include JavaScript controls to:

- add a row;
- remove the selected row;
- add a column;
- remove the selected column;
- recalculate commercial extended prices and total;
- open browser print/save PDF so the user can choose the PDF destination;
- save the edited HTML.

## Technical Proposal Columns

Technical proposal removes all pricing and total fields.

Visible columns:

- Item No.
- Customer requirement description.
- UOM.
- Qty.
- Bidder proposal description.
- Delivery time.

Forbidden in visible technical proposal:

- unit price;
- extended price;
- subtotal;
- VAT;
- total amount;
- supplier cost;
- internal margin;
- potential profit.

## Commercial Proposal Columns

Commercial proposal includes pricing.

Visible columns:

- Item No.
- Customer requirement description.
- UOM.
- Qty.
- Bidder proposal description.
- Unit price.
- Extended price.
- Delivery time.

Totals:

- `SUM (Exclusive of VAT)` or approved equivalent wording.
- VAT and final total only when present/approved in the source data or final template requirement.

## Live Neon Mapping

RFQ:

- `rfq_analysis.rfq_reference` -> RFQ reference.
- `rfq_analysis.subject` -> fallback reference/title.
- `rfq_analysis.required_currency` -> currency fallback.

Customer:

- `customers.company_name` -> `To:`.
- `customers.customer_address` -> customer address.
- `customers.phone` -> customer telephone.
- `customers.fax_number` -> customer fax.
- `customers.attention_person` -> `Attn:`.
- `customers.carbon_copy_person` -> `Cc:`.

Own company:

- `user_company.company_name` -> seller company name.
- `user_company.company_address` -> seller address.
- `user_company.company_number` -> seller telephone/company number fallback.
- `user_company.company_fax` -> seller fax.
- `user_company.company_email` -> fallback contact detail.

Items:

- `rfq_items.item_id` -> item number.
- `rfq_items.company_description` -> customer requirement description.
- `rfq_items.qty` -> quantity.
- `rfq_items.uom` -> UOM.
- `rfq_items.agent_item_summary` -> fallback technical text only when selected supplier text is missing.

Supplier proposal:

- `supplier_item_status.bidder_description` -> bidder proposal description.
- `supplier_item_status.delivery_time` -> delivery time.
- `supplier_item_status.currency_code` -> currency fallback.
- `supplier_item_status.manufacturer`, `item_origin`, `compliance_deviation`, and `evidence` -> optional technical appendix or review context, not default visible columns.

Quotation:

- `quotations.quotation_id` -> quotation number.
- `quotations.quotation_name` -> document title/name.
- `quotations.version_number` -> version context when needed.
- `quotations.generated_day` -> quotation date.
- `quotations.total_amount` -> commercial total cross-check.
- `quotations.transfer_currency_code` -> currency.
- `quotations.commercial_terms` -> terms.

Pricing:

- `quotation_pricing.sales_unit_price` -> unit price.
- `quotation_pricing.ext_price` -> extended price.
- `quotation_pricing.tax_rate` -> VAT/tax context if shown.
- `quotation_pricing.exchange_currency` -> currency fallback.
- `quotation_pricing.shipping_cost`, `discount_rate`, `profit_rate`, `exchange_rate`, `potential_profit` -> internal/audit values; do not expose unless explicitly approved.
- Commercial proposal pricing must come from `comercial-pricing` after the user-approved pricing canvas/review packet or explicit direct-pricing approval. If that approval cannot be verified, block final commercial output or mark it as draft/unapproved.

Assets:

- Canonical logo folder: `C:\Users\LENOVO\.codex\skills\report-generator\assets\logos`.
- Canonical signature folder: `C:\Users\LENOVO\.codex\skills\report-generator\assets\signatures`.
- The generator automatically uses the newest supported image from each folder when `-LogoPath` and `-SignaturePath` are omitted.
- Prefer stable canonical filenames such as `logo.png` and `signature.png`; older/replaced images may be archived with timestamped names if needed.
- `file_metadata.file_image` may contain image data, but do not assume it is a company logo/signature without live row evidence.
- If assets are unavailable, generate editable placeholders and report the missing assets.
