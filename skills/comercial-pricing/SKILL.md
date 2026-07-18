---
name: comercial-pricing
description: Calculate and persist QuoteFlow commercial quotation pricing. Use when Codex needs to create or update pricing variables, calculate sales_unit_price, ext_price, total_amount, potential_profit, or total_profit for RFQ quotation items; obtain web-app user review and approval before official pricing; and prepare approved pricing values for proposal review.
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

## Web App Navigation

For normal pricing review and user approval, return `http://localhost:3000/?view=pricing&rfqId=<id>`. Do not generate or open a standalone pricing canvas or HTML review packet for normal workflow use. Retain deterministic calculation validation data only as internal workflow evidence; generate a standalone artifact only when the customer explicitly requires it and verify its path before returning it.

## Workflow Stage

- Stage: `commercial_pricing`
- Previous stage: `certificate_origin_review` or `technical_compliance_review`.
- Next stage: `selected_offer`.
- Stage owner: `bid-package-orchestrator`.
- State persistence: after the user approves pricing in the web app or explicitly approves direct pricing, calculation is validated, and pricing is persisted, use `quoteflow-neon` to update stage fields when the target RFQ row is clear. On success, append this stage to `completed_stages`, set `current_stage` to the orchestrator-selected next stage, set `stage_status` to `ready_for_next_stage` or `in_progress`, clear/refresh `stage_blockers`, and write `next_required_action`. On block, do not advance `current_stage`; set `stage_status = blocked`, populate `stage_blockers`, and set `next_required_action` to the unblock action.
- Boundary: this skill calculates and persists pricing. It must not persist official customer-facing prices, advance to selected-offer, expose internal profit in customer-facing outputs, freeze final selected offers, or generate final bid forms until web-app or direct pricing approval is complete.
## Required Skills

- Use `$quoteflow-neon` for all database schema inspection, reads, inserts, updates, and persistence.
- Use the QuoteFlow web app pricing view for the dense, clear, professional approval form.
- Use `$report-generator` later for the canonical proposal deep link after pricing has been persisted. Generate a standalone proposal only when the customer explicitly requires it.

## Database Preflight

Before writing anything, use `$quoteflow-neon` to inspect live schemas on the QuoteFlow main branch for:

- `rfq_analysis`
- `rfq_items`
- `supplier_item_status`
- `quotations`
- `quotation_pricing`

Use the active QuoteFlow signup/company/user context from the orchestrator or `$quoteflow-neon`. Do not invent company/user IDs.

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

## Pricing Review

Preferred interactive UI: use the reusable QuoteFlow web app pricing panel when it is available:

```text
C:\Users\LENOVO\.codex\skills\quoteflow-webapp
```

The web app Pricing panel is the normal interactive review surface for local work. It must keep the two-tier behavior: typing edits pricing variables in React memory only; pressing `Apply` calculates and persists official pricing through the app API/database path. After web app persistence, re-read `quotations` and `quotation_pricing` through `quoteflow-neon` before reporting success or advancing the workflow stage.

After pricing is applied, use `http://localhost:3000/?view=proposal&rfqId=<id>` for technical/commercial proposal review. Retain `pricing-calculator.ps1` solely for deterministic validation.

Use the web-app Pricing view for every official commercial-pricing run unless the user explicitly approves direct pricing in chat. Build the review from `$quoteflow-neon` sourced `rfq_items`, supplier candidates, existing pricing variables, and quotation header data.

## Internal Pricing Validation Evidence

Store deterministic validation evidence only when needed for audit or retry, scoped by RFQ reference or `rfq_id`:

```text
C:\Users\LENOVO\.codex\skills\comercial-pricing\output\<rfq-reference-or-rfq_id>\
```

Use filesystem-safe folder names. Replace characters outside letters, numbers, dash, underscore, and dot with `_`.

Mandatory files:

- `pricing-input.json`: Neon-sourced web-app pricing input built from `rfq_items`, `supplier_item_status`, `quotation_pricing`, and `quotations`.
- `pricing-output-calculated.json`: calculated JSON received from the approved web-app review or direct approval.
- `pricing-output-approved.json`: final user-approved pricing JSON used as the persistence source.
- `pricing-validation.json`: deterministic verification result from `pricing-calculator.ps1` or an equivalent verified formula before Neon persistence. Do not retire the PowerShell validator based on the interactive Pricing panel alone.

Optional files:

- `pricing-warnings.json`: missing price, skipped item, currency, rounding, or supplier-selection warnings.
- `pricing-persistence-result.json`: inserted/updated/skipped row counts and quotation total after Neon persistence.

Do not return these internal JSON paths or local preview links during normal workflow. Return the canonical pricing deep link and concise approval status instead.

For the mandatory web-app review:

1. Build a RFQ-specific `pricing-input.json` containing one array entry per `rfq_items` row. Each entry must preserve `item_id`, `company_description`, `qty`, `uom`, selected supplier/candidate supplier metadata, bidder price, currency, existing `quotation_pricing` values, and current/default pricing variables.
2. Use the canonical pricing deep link with the RFQ ID; do not copy or generate a static HTML canvas.
3. Stop before official persistence and require web-app review or explicit direct approval.
4. Treat approved web-app values or explicit approval as the approval source. Save validation evidence only when needed for audit or retry, and record the approval source in the chat report.

The canvas supports:

- Auto-loaded RFQ item cells from the `$quoteflow-neon` sourced pricing input array.
- Search by item ID, description, supplier, or currency above the pricing board.
- A scrollable item-cell board where each item has its own quotation-pricing input box.
- Per-item pricing variable edits for `shipping_cost`, `tax_rate`, `exchange_rate`, `profit_rate`, and `discount_rate`.
- Checkboxes per item for bulk updates.
- Bulk applying variables to checked selected items.
- Bulk applying variables to all items.
- Supplier selection metadata.
- Instant JavaScript calculation preview for every item.
- A live results board under the item-cell board and above the action buttons.
- A left-side `Calculate` action and right-side `Print output JSON` / copy output action.
- Export/copy of calculated JSON for persistence.

The canvas is the official review gate. JavaScript is the live user-facing calculator so the user can see item and total changes immediately. Database persistence must still be performed by Codex through `$quoteflow-neon` only after the user accepts or provides the final pricing JSON. Before persistence, verify the approved JSON with `pricing-calculator.ps1` or an equivalent deterministic formula to catch browser/editing mistakes. Do not silently use defaults to create final prices unless the user has seen and approved those defaults.

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
5. Build and save the RFQ-specific pricing input array from `rfq_items`, joined supplier candidates, existing `quotation_pricing`, and quotation header data. Every `rfq_items` row must appear in the array unless it is explicitly skipped with a reason.
6. Return `http://localhost:3000/?view=pricing&rfqId=<id>` and stop for item-level pricing variable entry, selected-item bulk update, all-item bulk update, supplier selection, and approval in the web app.
8. Accept the user's exported/copied calculated pricing JSON or explicit chat approval as the approval source; if the user changes values in chat, rebuild the pricing input and restate the final variables before calculation.
9. Save the user's calculated JSON as `pricing-output-calculated.json`, save the approved persistence source as `pricing-output-approved.json`, then run `pricing-calculator.ps1` or equivalent deterministic formula after approval to verify the JavaScript-calculated output before database persistence. Save the verification output as `pricing-validation.json`.
10. Persist each item to `quotation_pricing`:
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
11. Persist `total_amount` to `quotations.total_amount`.
12. Return a concise chat report with approval source, item count, total amount, total profit, and warnings.

Do not store `total_profit` in the quotation document output unless the user explicitly asks. It is a business-margin value and should remain in the internal chat/report summary.

## Write Safety

- Inspect `quotation_pricing` immediately before writes.
- Do not invent columns.
- Do not persist official pricing or advance the stage from `commercial_pricing` until the user has completed web-app review or explicitly approved direct pricing.
- Use scoped upsert/update behavior consistent with live primary keys. Current live primary key is `quotation_pricing.item_id`; if that remains true, only one pricing row can exist per item. Report this limitation if multiple quotations per same item are needed.
- If the same item has multiple supplier candidates, persist pricing only after a supplier candidate is selected.
- Do not overwrite existing pricing variables without user approval when they differ from the proposed inputs.
- If currency conversion is needed, require `exchange_rate` and preserve `currency_code`/`exchange_currency` clearly.

## Chat Report

After calculation/persistence, return directly in chat:

- `quotation_id`
- canonical pricing deep link
- `pricing-input.json`, `pricing-output-calculated.json`, `pricing-output-approved.json`, and `pricing-validation.json` paths when created
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
- Confirm the web-app pricing view was populated from a `$quoteflow-neon` sourced `rfq_items` array, joined to supplier/pricing rows where available.
- Confirm every `rfq_items` row is represented in the pricing review or listed as skipped with a reason.
- Confirm the user approved web-app pricing or direct chat pricing variables before persistence.
- Confirm `pricing-output-approved.json` exists and is non-empty before persistence.
- Confirm the browser-calculated JSON was verified by `pricing-calculator.ps1` or an equivalent deterministic formula before persistence.
- Confirm `pricing-validation.json` exists and records the deterministic verification result before Neon writes.
- Confirm all null pricing variables used documented defaults.
- Confirm `sales_unit_price`, `ext_price`, and `potential_profit` are numeric.
- Confirm `total_amount` equals `roundPrice(sum(ext_price))`.
- Re-read updated rows through `$quoteflow-neon` when persistence is performed.
- Report any skipped item and why.
