# QuoteFlow Neon Schema Map

These are known hints from a successful Neon inspection. Always re-check the live schema before writing.

## Neon Target Hints

- Project name: `quoteflow_ai`
- Project id: `wandering-bar-14365580`
- Main branch id: `br-soft-smoke-ahc5mcj6`
- Database: `neondb`
- PostgreSQL version observed: 17

## Default Workflow Context

- `company_id = 1`
- `user_id = 1`

Use these defaults for QuoteFlow database work unless explicit user input or live data proves another context is required.

## RFQ Tables

### incoming_emails

Known columns:

- `id`
- `message_id`
- `from_email`
- `from_name`
- `to_recipients`
- `cc_recipients`
- `subject`
- `email_body_text`
- `attachments_parsed`
- `classification_type`
- `classification_confidence`
- `rfq_id`
- `user_id`
- `company_id`
- `received_at`
- `processed_at`
- `created_at`

Known constraints:

- Primary key on `id`
- Unique key on `message_id`
- Foreign key `rfq_id` to `rfq_analysis.rfq_id`
- Foreign key `company_id` to `user_company.company_id`

### rfq_analysis

Known columns:

- `rfq_id`
- `company_id`
- `user_id`
- `rfq_reference`
- `subject`
- `analysis_content`
- `analysis_status`
- `created_at`
- `updated_at`
- `required_currency`
- `deadline_period`
- `closing_time`
- `current_stage`
- `unread_count`
- `last_preview_type`

Known constraints:

- Primary key on `rfq_id`
- Foreign key `company_id` to `user_company.company_id`

### rfq_items

Known columns:

- `id`
- `company_id`
- `rfq_id`
- `user_id`
- `company_description`
- `qty`
- `uom`
- `created_at`
- `item_id`
- `agent_item_summary`

Known constraints:

- Primary key on `id`
- Unique key on `(rfq_id, item_id)`
- Foreign key `rfq_id` to `rfq_analysis.rfq_id`
- Foreign key `company_id` to `user_company.company_id`

### user_company

Known columns:

- `company_id`
- `company_name`
- `company_number`
- `company_address`
- `company_fax`
- `company_email`
- `created_at`
- `updated_at`

## Persistence Notes

- Use `incoming_emails.message_id` for deduplication when available.
- Use `rfq_items (rfq_id, item_id)` for item upsert behavior.
- Do not insert RFQ rows without `company_id` when the live schema requires it.
- Prefer `company_id = 1`, `user_id = 1` for the current single-company QuoteFlow workflow.
