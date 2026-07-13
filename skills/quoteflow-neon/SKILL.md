---
name: quoteflow-neon
description: QuoteFlow AI Neon Postgres database guardrails and defaults. Use when Codex needs to inspect, query, insert, update, delete, migrate, repair, or persist data in the QuoteFlow AI / AUTOMATE_PROCUREMENT Neon database; when a workflow mentions Neon, Postgres, rfq_analysis, incoming_emails, rfq_items, user_company, company_id, user_id, database schema, missing columns, missing tables, or persistence; and before rfq-analysis performs any database work. Always prefer the built-in Neon Postgres plugin, target the quoteflow_ai project, and apply the default company_id and user_id context unless safely overridden.
---

# QuoteFlow Neon

## Purpose

Use this skill as the database guardrail layer for QuoteFlow AI / AUTOMATE_PROCUREMENT workflows. It standardizes Neon project selection, live schema inspection, company/user context, and safety rules before any database read, write, migration, repair, or persistence action.

Use the built-in Neon Postgres plugin. Do not depend on local migration files, ORM files, or copied schema notes when Neon is available.

## Default Context

Use these defaults unless the user supplies different values or live Neon data clearly proves they are wrong:

- Project name: `quoteflow_ai`
- Project id hint: `wandering-bar-14365580`
- Database: `neondb`
- Main branch id: `br-soft-smoke-ahc5mcj6`
- Default `company_id`: `1`
- Default `user_id`: `1`
- Signup identity file: `C:\Users\LENOVO\.codex\skills\bid-package-orchestrator\signup\SIGNUP.txt`

Treat the project id as a hint from a successful prior inspection, not a permanent configuration. Re-check Neon if project lookup fails or if multiple projects appear. For live QuoteFlow work, use the main branch id above unless the user explicitly asks to inspect or test a temporary branch.

Before falling back to `company_id = 1` and `user_id = 1`, read the signup identity file when it exists. If it contains `SIGNUP=true` plus populated `company_id` and `user_id`, use those IDs as the QuoteFlow identity context for reads, inserts, updates, stage persistence, scheduled tasks, and report generation.

## Core Rules

1. Prefer Neon plugin tools for database truth.
2. Search/list Neon projects and select `quoteflow_ai` before using project hints.
3. Inspect live schema before writes using `describe_table_schema` or equivalent.
4. Prefer `company_id` and `user_id` from the signup identity file when `SIGNUP=true`; otherwise apply `company_id = 1` and `user_id = 1` to QuoteFlow workflow reads/writes only when no safer user-provided context exists.
5. Never invent IDs other than these explicit defaults.
6. Do not silently run destructive actions.
7. Do not run production schema changes without explicit user approval.
8. For live fetching, inserting, updating, deleting, and RFQ persistence, explicitly target the main branch `br-soft-smoke-ahc5mcj6` when the Neon tool accepts a branch id.
9. Use temporary-branch migration workflow only to validate schema repair, then apply approved changes to the main branch and verify main afterward.
10. Keep SQL scoped by `company_id` and, where appropriate, `user_id`.
11. Report when persistence is skipped because required context is ambiguous.

## Workflow

### 1. Resolve Neon Target

Use Neon project listing/search. Select the project named `quoteflow_ai`.

If found, inspect the project and target the main branch `br-soft-smoke-ahc5mcj6` for live data operations. Use database `neondb` unless Neon reports another active database is required.

If the project is not found, search by likely terms:

- `quoteflow`
- `QuoteFlow`
- `AUTOMATE_PROCUREMENT`
- `procurement`

If no clear target exists, stop database work and ask for the correct Neon project.

### 2. Inspect Schema

Before any write, inspect relevant live tables. Common tables:

- `incoming_emails`
- `rfq_analysis`
- `rfq_items`
- `user_company`
- `customers`
- `quotations`
- `quotation_pricing`
- `supplier_item_status`
- `supplier_memory`
- `supplier_quote_normalizations`
- `technical_compliance_reviews`
- `certificate_origin_reviews`
- `selected_offers`
- `email_table`
- `rfq_email_events`
- `scheduled_tasks`
- `rfq_watch_targets`

For RFQ workflows, inspect at minimum:

- `incoming_emails`
- `rfq_analysis`
- `rfq_items`
- `user_company`

Use `references/quoteflow-schema-map.md` for known table hints after checking Neon live schema.

### 3. Apply Company/User Context

Default all QuoteFlow actions to:

```text
company_id = 1
user_id = 1
```

First read the signup identity file:

```text
C:\Users\LENOVO\.codex\skills\bid-package-orchestrator\signup\SIGNUP.txt
```

If the file has `SIGNUP=true` and non-empty `company_id` and `user_id`, use those values instead of the hardcoded defaults. If the file is missing, incomplete, or has `SIGNUP=false`, use `company_id = 1` and `user_id = 1` only when no explicit alternative is supplied and the write is otherwise safe.

For reads, include the resolved `company_id` when the table has `company_id`. Include the resolved `user_id` when the table has `user_id` and the query is user-scoped.

For inserts/updates, include both resolved fields when the live table has those columns. If a table requires `company_id` and does not allow nulls, use the signup value when present, otherwise use `1` unless the user explicitly supplies another company id. Pass the main branch id for live writes when the Neon tool supports it.

Do not edit `SIGNUP.txt` from this skill except to report the path or read identity context. The signup bootstrap and file update are owned by `bid-package-orchestrator`.

For deletes, broad updates, migrations, and data repair, show the target scope first and ask for approval. If approved, execute live deletes and broad updates on the main branch only, scoped as tightly as possible.

### 4. RFQ Persistence Pattern

When called from `rfq-analysis`:

1. Upsert or insert `incoming_emails` using `message_id` as the deduplication key when that unique constraint exists.
2. Insert or update `rfq_analysis` with `company_id = 1`, `user_id = 1`, `rfq_reference`, `subject`, `analysis_content`, `analysis_status`, `required_currency`, `deadline_period`, and `closing_time` where columns exist.
3. Insert or update `rfq_items` with `company_id = 1`, `user_id = 1`, `rfq_id`, `item_id`, `company_description`, `qty`, `uom`, and `agent_item_summary` where available.
4. Use the live unique key on `(rfq_id, item_id)` when present to avoid duplicate items.
5. Link `incoming_emails.rfq_id` to `rfq_analysis.rfq_id` when the column exists.

Do not claim an RFQ was saved unless the Neon write succeeded.

### 5. Stage Result Persistence Pattern

For QuoteFlow stages, database persistence is part of stage completion. Do not report a stage as successfully complete until the stage-specific result table is written and rechecked, or until a clear schema/context blocker is recorded in `rfq_analysis.stage_blockers`.

Use this default target map after inspecting the live schema:

- Supplier search results -> `supplier_item_status`.
- Supplier quote normalization -> `supplier_quote_normalizations`.
- Technical compliance review -> `technical_compliance_reviews`.
- Certificate and origin review -> `certificate_origin_reviews`.
- Commercial pricing -> `quotation_pricing` and `quotations`.
- Selected/frozen offers -> `selected_offers`.
- Incoming customer/supplier/OEM/manufacturer/distributor replies -> `incoming_emails`, plus `rfq_email_events` when available.
- Outgoing approved customer/supplier emails -> `email_table`, plus `rfq_email_events` when available.
- Follow-up watches and reminders -> `scheduled_tasks` and `rfq_watch_targets`.

If the mapped table does not exist, or if required columns are missing, do not silently substitute another table. Prepare a temporary-branch migration or report the exact schema gap. If an existing compatible table is intentionally used, name the table, columns, deduplication key, and reason in the result.

When inserting rows with identity primary keys, omit the identity `id` column and let Postgres assign it. Only use an existing `id` when updating a row found by a scoped duplicate check. Never invent row IDs.

After stage-specific persistence succeeds, update `rfq_analysis.current_stage`, `stage_status`, `next_required_action`, `stage_blockers`, and `completed_stages` through this skill. If persistence fails, set or request `stage_status = blocked`, keep the workflow at the current stage, and include the failed table and scope in `stage_blockers`.

### 6. Schema Repair

If a needed table or column is missing:

1. Confirm the gap with live Neon schema tools.
2. Prepare a migration on a temporary branch using Neon migration tooling.
3. Verify the migration on the temporary branch.
4. Ask for explicit approval before applying to main.
5. Apply approved schema changes to main only.
6. After applying, re-inspect the main branch schema.

Do not use direct production DDL unless the user explicitly approves the exact change and risk.

## Safety Rules

- Read-only searches may run on the main branch with default context without extra confirmation.
- Inserts and scoped updates may run on the main branch with `company_id = 1`, `user_id = 1` when the user asked for persistence and the target row identity is clear.
- Deletes always require confirmation.
- Bulk updates always require confirmation.
- Schema changes always require confirmation after temporary-branch verification.
- Ambiguous project, company, user, or customer identity must be surfaced before writing. Ambiguous branch selection should resolve to main for live QuoteFlow operations unless the user explicitly requests another branch.

## Output

When reporting database work, state:

- Neon project/database used.
- Main branch used for live operations, or temporary branch used for migration validation.
- Tables inspected.
- Whether defaults `company_id = 1` and `user_id = 1` were applied.
- Writes performed or skipped.
- Any schema gaps or migration status.

Do not expose credentials, connection strings, raw tokens, or unrelated table data.
