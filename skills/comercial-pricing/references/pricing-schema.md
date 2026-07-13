# Comercial Pricing Schema Notes

Use `$quoteflow-neon` to verify live schema before every write. These notes reflect the schema inspected during skill creation and are not a substitute for live inspection.

## Tables

### supplier_item_status

Useful input columns:

- `rfq_id`
- `item_id`
- `id` as `supplier_status_id`
- `supplier_name`
- `bidder_unit_price`
- `currency_code`
- `status`
- `company_id`
- `user_id`

Purpose: bidder/supplier source for base price and currency.

### rfq_items

Useful input columns:

- `rfq_id`
- `item_id`
- `company_description`
- `qty`
- `uom`
- `agent_item_summary`
- `company_id`
- `user_id`

Purpose: item quantity and exact item identity.

### quotation_pricing

Input/persistence columns:

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

Live primary key observed: `item_id`. This means only one pricing row per item unless the schema changes. If multiple quotations per same item are needed, flag this limitation before writing.

### quotations

Useful columns:

- `quotation_id`
- `rfq_id`
- `company_id`
- `user_id`
- `quotation_status`
- `version_number`
- `total_amount`
- `transfer_currency_code`

Persist final quotation total to `quotations.total_amount`.

### rfq_analysis

Useful context columns:

- `rfq_id`
- `rfq_reference`
- `subject`
- `required_currency`
- `closing_time`
- `deadline_period`

Do not write total amount to `rfq_analysis`; no `total_amount` column was present during inspection.

## Formula Defaults

- `shipping_cost`: `0`
- `tax_rate`: `1.1`
- `exchange_rate`: `1.0`
- `profit_rate`: `1.25`
- `discount_rate`: `0`

## Rounding

`sales_unit_price`: nearest 1 using Math.round / away-from-half quirks should be avoided. Use deterministic half-up style if implementing outside JavaScript is possible.

`ext_price` and `total_amount`: nearest 1000 with minimum 1000 for positive values.

`potential_profit` and `total_profit`: no additional rounding after item formula.
