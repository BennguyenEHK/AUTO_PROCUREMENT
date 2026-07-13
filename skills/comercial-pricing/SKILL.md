---
name: comercial-pricing
description: Calculate and persist QuoteFlow commercial quotation pricing. Use when Codex needs to create or update pricing variables, calculate sales_unit_price, ext_price, total_amount, potential_profit, or total_profit for RFQ quotation items; build a mandatory pricing canvas for user review and approval before official pricing; fetch bidder prices from supplier_item_status, quantities from rfq_items, pricing variables/results from quotation_pricing, quotation totals from quotations, and RFQ context from rfq_analysis through $quoteflow-neon; or prepare approved pricing values handed to report-generator for native editable commercial proposal HTML/PDF generation.
---

# Comercial Pricing

## Purpose

Use this skill to calculate quotation pricing outputs needed for final quotation generation:

- `sales_unit_price`
- `ext_price`
- `potential_profit`
- `quotations.total_amount`
- chat-only `total_profit`

This skill is intentionally named `comercial-pricing` to match the user's requested skill name. It is the pricing calculation and persistence layer, not the final Excel/PDF proposal generator.

## Workflow Stage

- Stage: `commercial_pricing`
- Previous stage: `certificate_origin_review` or `technical_compliance_review`.
- Next stage: `selected_offer`.
- Stage owner: `bid-package-orchestrator`.
- State persistence: after the user approves the pricing canvas/exported pricing JSON, calculation is validated, and pricing is persisted, use `quoteflow-neon` to update stage fields when the target RFQ row is clear. On success, append this stage to `completed_stages`, set `current_stage` to the orchestrator-selected next stage, set `stage_status` to `ready_for_next_stage` or `in_progress`, clear/refresh `stage_blockers`, and write `next_required_action`. On block, do not advance `current_stage`; set `stage_status = blocked`, populate `stage_blockers`, and set `next_required_action` to the unblock action.
- Boundary: this skill calculates and persists pricing. It must not persist official customer-facing prices, advance to selected-offer, expose internal profit in customer-facing outputs, freeze final selected offers, or generate final bid forms until the pricing canvas review is completed and approved by the user.
## Required Skills

- Use `$quoteflow-neon` for all database schema inspection, reads, inserts, updates, and persistence.
- Use `$frontend-design` guidance for the pricing canvas: dense, clear, professional, searchable/editable, not a landing page.
- Use `$report-generator` later for native editable commercial proposal HTML/PDF outputs after pricing has been persisted. Do not use spreadsheet, document, or PDF plugins for the QuoteFlow proposal generation path.

## Database Preflight

Before writing anything, inspect live schemas on the QuoteFlow main branch for:

- `rfq_analysis`
- `rfq_items`
- `supplier_item_status`
- `quotations`
- `quotation_pricing`

Use default `company_id = 1` and `user_id = 1` unless the user supplies safer explicit context.

Observed live schema facts:

- `supplier_item_status` has `rfq_id`, `item_id`, `bidder_unit_price`, `currency_code`, `supplier_name`, `status`, `company_id`, `user_id`.
- `rfq_items` has `rfq_id`, `item_id`, `qty`, `uom`, `company_description`, `agent_item_summary`, `company_id`, `user_id`.
- `quotation_pricing` has `item_id`, `quotation_id`, `shipping_cost`, `exchange_currency`, `tax_rate`, `profit_rate`, `discount_rate`, `sales_unit_price`, `ext_price`, `potential_profit`, `exchange_rate`, `company_id`, `user_id`.
- `quotations` has `quotation_id`, `rfq_id`, `total_amount`, `transfer_currency_code`, `quotation_status`, `version_number`, `company_id`, `user_id`.
- `rfq_analysis` currently does not have `total_amount`; do not write totals there.

If required rows are missing:

- Missing `quotation`: create or ask to create one through `$quoteflow-neon`, respecting live constraints.
- Missing supplier bidder price: stop for that item or ask the user to choose/provide the bidder price.
- Multiple supplier bidder prices for one item: the pricing canvas must require choosing the supplier row that drives calculation.

## Pricing Formula

Use these defaults only when the corresponding pricing variable is null:

- `shipping_cost`: `0`
- `tax_rate`: `1.1`
- `exchange_rate`: `1.0`
- `profit_rate`: `1.25`
- `discount_rate`: `0`

Per item:

```text
actual_unit_price = ((bidder_unit_price + shipping_cost) * tax_rate) * exchange_rate
profit_unit_price = actual_unit_price * profit_rate
discount_amount   = profit_unit_price * discount_rate

sales_unit_price  = Math.round(profit_unit_price - discount_amount)
ext_price         = roundPrice(sales_unit_price * qty)
potential_profit  = (Math.round(profit_unit_price) - Math.round(actual_unit_price)) * qty
```

Totals:

```text
total_amount = roundPrice(sum(ext_price))
total_profit = sum(potential_profit)
```

`roundPrice(value)` means nearest `1000`, with minimum `1000` when the value is positive but rounds below `1000`.

Important rounding notes:

- `sales_unit_price` rounds to nearest `1`.
- `ext_price` rounds to nearest `1000`, so it may not exactly equal `sales_unit_price * qty` after rounding.
- `total_profit` is not rounded and is for chat/report summary only.

## Pricing Canvas

Use `assets/pricing-canvas.html` as the reusable local review template. For every official commercial-pricing run, the canvas review is mandatory unless the user explicitly says to skip the canvas and approve pricing directly in chat for a small/simple RFQ.

For the mandatory review packet:

1. Build a RFQ-specific `pricing-input.json` containing the selected supplier candidate, bidder price, quantity, currency, and current/default pricing variables for every item.
2. Place the review packet in the RFQ working folder when one exists, otherwise in a clear local workspace folder. Include the pricing input JSON and either a copied RFQ-specific HTML canvas or a clear path/link to the reusable canvas plus the JSON to paste/import.
3. Return the absolute Windows path and browser-safe `file:///C:/...` link for the canvas or review packet.
4. Stop before official persistence. Ask the user to enter/adjust item-level values such as `shipping_cost`, `tax_rate`, `exchange_rate`, `profit_rate`, `discount_rate`, and supplier selection, then export or approve the calculated JSON.
5. Treat the user's exported JSON or explicit approval message as the approval source. Record that approval source in the chat report.

The canvas supports:

- JSON import/paste.
- Per-item pricing variable edits.
- Bulk applying variables to selected items.
- Supplier selection metadata.
- Instant calculation preview.
- Export of calculated JSON for persistence.

The canvas is the official review gate. Database persistence must still be performed by Codex through `$quoteflow-neon` only after the user accepts or provides the final pricing JSON. Do not silently use defaults to create final prices unless the user has seen and approved those defaults.

Input JSON shape for the canvas and calculator:

```json
{
  "rfq_id": 1,
  "quotation_id": 1,
  "company_id": 1,
  "user_id": 1,
  "items": [
    {
      "item_id": 1,
      "company_description": "exact item description",
      "qty": 10,
      "uom": "EA",
      "supplier_status_id": 1,
      "supplier_name": "Supplier",
      "bidder_unit_price": 100000,
      "currency_code": "VND",
      "shipping_cost": null,
      "tax_rate": null,
      "exchange_rate": null,
      "profit_rate": null,
      "discount_rate": null
    }
  ]
}
```

Run deterministic calculation without the browser:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:\Users\LENOVO\.codex\skills\comercial-pricing\scripts\pricing-calculator.ps1 `
  -InputJson C:\path\to\pricing-input.json
```

The script returns JSON with calculated item rows and totals.

## Persistence Workflow

1. Fetch RFQ items from `rfq_items` scoped by `rfq_id`, `company_id`, and `user_id` when applicable.
2. Fetch candidate supplier rows from `supplier_item_status` for the same `rfq_id` and item IDs.
3. Fetch or create/select the target `quotations` row for the RFQ.
4. Fetch existing `quotation_pricing` rows for that `quotation_id`.
5. Build and save the RFQ-specific pricing canvas input using bidder price, qty, selected supplier candidate, and existing pricing variables.
6. Present the pricing canvas/review packet path to the user and stop for item-level pricing variable entry, supplier selection, and approval.
7. Accept the user's exported pricing JSON or explicit chat approval as the approval source; if the user changes values in chat, rebuild the pricing input and restate the final variables before calculation.
8. Run `pricing-calculator.ps1` or equivalent formula only after approval.
9. Persist each item to `quotation_pricing`:
   - `item_id`
   - `quotation_id`
   - `company_id`
   - `user_id`
   - `shipping_cost`
   - `exchange_currency`
   - `tax_rate`
   - `profit_rate`
   - `discount_rate`
   - `exchange_rate`
   - `sales_unit_price`
   - `ext_price`
   - `potential_profit`
10. Persist `total_amount` to `quotations.total_amount`.
11. Return a concise chat report with approval source, item count, total amount, total profit, and warnings.

Do not store `total_profit` in the quotation document output unless the user explicitly asks. It is a business-margin value and should remain in the internal chat/report summary.

## Write Safety

- Inspect `quotation_pricing` immediately before writes.
- Do not invent columns.
- Do not persist official pricing or advance the stage from `commercial_pricing` until the user has completed or explicitly approved the pricing canvas/review packet.
- Use scoped upsert/update behavior consistent with live primary keys. Current live primary key is `quotation_pricing.item_id`; if that remains true, only one pricing row can exist per item. Report this limitation if multiple quotations per same item are needed.
- If the same item has multiple supplier candidates, persist pricing only after a supplier candidate is selected.
- Do not overwrite existing pricing variables without user approval when they differ from the proposed inputs.
- If currency conversion is needed, require `exchange_rate` and preserve `currency_code`/`exchange_currency` clearly.

## Chat Report

After calculation/persistence, return directly in chat:

- `quotation_id`
- pricing canvas/review packet path when created
- approval source for final pricing variables
- number of priced items
- `total_amount`
- `total_profit`
- per-item brief: item ID, supplier, bidder unit price, sales unit price, extended price, potential profit
- warnings about missing bidder prices, defaulted variables, rounding mismatches, or currency conversion

Do not include `potential_profit` or `total_profit` in generated customer-facing HTML/PDF quotation unless explicitly requested and approved for external disclosure.

## Validation

Before finalizing:

- Confirm every priced row has `bidder_unit_price` and `qty`.
- Confirm the user approved the pricing canvas/review packet, exported JSON, or direct chat pricing variables before persistence.
- Confirm all null pricing variables used documented defaults.
- Confirm `sales_unit_price`, `ext_price`, and `potential_profit` are numeric.
- Confirm `total_amount` equals `roundPrice(sum(ext_price))`.
- Re-read updated rows through `$quoteflow-neon` when persistence is performed.
- Report any skipped item and why.

