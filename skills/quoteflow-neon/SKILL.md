---
name: quoteflow-neon
description: QuoteFlow AI Neon Postgres database guardrails and tenant identity rules. Use when Codex needs to inspect, query, insert, update, delete, migrate, repair, or persist data in the QuoteFlow AI / AUTOMATE_PROCUREMENT Neon database; when a workflow mentions Neon, Postgres, rfq_analysis, incoming_emails, rfq_items, user_company, company_id, user_id, database schema, missing columns, missing tables, or persistence; and before rfq-analysis performs any database work. Always prefer the built-in Neon Postgres plugin, target the quoteflow_ai project, and require an active signup identity or an explicit company/user pair.
---

# QuoteFlow Neon

## Purpose

Use this skill as the database guardrail layer for QuoteFlow AI / AUTOMATE_PROCUREMENT workflows. It standardizes Neon project selection, live schema inspection, company/user context, and safety rules before any database read, write, migration, repair, or persistence action.

Use the built-in Neon Postgres plugin. Do not depend on local migration files, ORM files, or copied schema notes when Neon is available.

## Target And Identity Context

Use this known target context unless the user supplies different values or live Neon data clearly proves it is wrong:

- Project name: `quoteflow_ai`
- Project id hint: `wandering-bar-14365580`
- Database: `neondb`
- Main branch id: `br-soft-smoke-ahc5mcj6`
- Primary signup identity file: `C:\Users\LENOVO\.codex\skills\quoteflow-webapp\SIGNUP.json`

Treat the project id as a hint from a successful prior inspection, not a permanent configuration. Re-check Neon if project lookup fails or if multiple projects appear. For live QuoteFlow work, use the main branch id above unless the user explicitly asks to inspect or test a temporary branch.

Resolve tenant identity from the web-app `SIGNUP.json`. It is valid only when it contains `signup: true` plus positive `company_id` and `user_id` values. If it is missing or inactive, stop and direct the user to setup/sign-up, unless the user supplied both IDs explicitly. Never infer or substitute a default tenant.

## Core Rules

1. Prefer Neon plugin tools for database truth.
2. Search/list Neon projects and select `quoteflow_ai` before using project hints.
3. Inspect live schema before writes using `describe_table_schema` or equivalent.
4. Require `company_id` and `user_id` from an active signup identity or from a complete explicit pair for every tenant-scoped action.
5. Never invent tenant IDs or continue with a partial or ambiguous identity.
6. Do not silently run destructive actions.
7. Do not run production schema changes without explicit user approval.
8. For live fetching, inserting, updating, deleting, and RFQ persistence, explicitly target the main branch `br-soft-smoke-ahc5mcj6` when the Neon tool accepts a branch id.
9. Use temporary-branch migration workflow only to validate schema repair, then apply approved changes to the main branch and verify main afterward.
10. Keep SQL scoped by `company_id` and, where appropriate, `user_id`.
11. Report when persistence is skipped because required context is ambiguous.

## TypeScript Helper CLI

For repeated deterministic QuoteFlow database actions, this skill may use the thin CLI adapter owned by the QuoteFlow web app. The command implementation and identity logic live under the same web app in `lib\db`:

```text
C:\Users\LENOVO\.codex\skills\quoteflow-webapp
```

The helper is for speed and repeatability only. It does not replace the Neon plugin as the safety/source-of-truth layer. Use the Neon plugin for live schema inspection, uncertain writes, migrations, broad updates, destructive actions needing review, or debugging ambiguous database state.

The helper reads `DATABASE_URL` from the environment. Never write real database URLs, credentials, tokens, or connection strings into `SKILL.md`, source files, reports, logs, or final answers.

Before any helper command, run the shared read-only setup preflight and stop if it fails:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:\Users\LENOVO\.codex\skills\bid-package-orchestrator\signup\setup-preflight.ps1 -WebAppPath C:\Users\LENOVO\.codex\skills\quoteflow-webapp -NeonScriptsPath C:\Users\LENOVO\.codex\skills\quoteflow-webapp
Set-Location C:\Users\LENOVO\.codex\skills\quoteflow-webapp
```

The preflight must complete successfully and report a passed database ping. Do not bypass it by running a copied helper from another folder. Use `npm.cmd` on Windows so command resolution is deterministic.

Supported helper commands:

```powershell
npm.cmd run db -- ping
npm.cmd run db -- identity
npm.cmd run db -- describe-table --table rfq_analysis
npm.cmd run db -- fetch-rfq --rfq-id 123
npm.cmd run db -- fetch-items --rfq-id 123
npm.cmd run db -- update-stage --rfq-id 123 --current-stage supplier_search --stage-status in_progress --dry-run
npm.cmd run db -- upsert-supplier-items --input supplier-items.json --dry-run
npm.cmd run db -- upsert-pricing --input pricing-output-approved.json --dry-run
npm.cmd run db -- cleanup-watch --rfq-id 123 --dry-run
npm.cmd run db -- cleanup-watch --rfq-id 123 --apply
```

Use helper commands only when the target table and row identity are clear. Prefer `--dry-run` before write-like commands. Deletes still require explicit user approval and the helper's `--apply` flag.

Tenant-scoped helper commands must resolve identity before execution. They read the canonical web-app `SIGNUP.json`, or accept both `--company-id` and `--user-id` explicitly. Missing, inactive, partial, or invalid identity is a hard failure. When live tables include `company_id` or `user_id`, helper reads/writes and duplicate checks must include those filters or values.

Do not add a general arbitrary-SQL command to the helper for ordinary workflow use. Add narrow commands with scoped filters instead.

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

### 3. Resolve Company/User Context

First read the signup identity files:

```text
C:\Users\LENOVO\.codex\skills\quoteflow-webapp\SIGNUP.json
```

If `SIGNUP.json` has `signup: true` and positive integer `company_id` and `user_id` values, use those values. A user-supplied override is valid only when both `company_id` and `user_id` are supplied as positive integers. If the file and explicit pair do not provide a complete identity, stop the database action and direct the user to setup/sign-up. There is no default tenant fallback.

For reads, include the resolved `company_id` when the table has `company_id`. Include the resolved `user_id` when the table has `user_id` and the query is user-scoped.

For inserts/updates, include both resolved fields when the live table has those columns. If a table requires `company_id` or `user_id` and the resolved identity is unavailable, do not write. Pass the main branch id for live writes when the Neon tool supports it.

Do not edit `SIGNUP.json` from this skill. The signup bootstrap and file update are owned by the QuoteFlow web app.

For deletes, broad updates, migrations, and data repair, show the target scope first and ask for approval. If approved, execute live deletes and broad updates on the main branch only, scoped as tightly as possible.

### 4. RFQ Persistence Pattern

When called from `rfq-analysis`:

1. Upsert or insert `incoming_emails` using `message_id` as the deduplication key when that unique constraint exists.
2. Insert or update `rfq_analysis` with the resolved signup identity, `rfq_reference`, `subject`, `analysis_content`, `analysis_status`, `required_currency`, `deadline_period`, and `closing_time` where columns exist.
3. Insert or update `rfq_items` with the resolved signup identity, `rfq_id`, `item_id`, `company_description`, `qty`, `uom`, and `agent_item_summary` where available.
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

### 6. Final RFQ Watch Cleanup Pattern

When called by `bid-package-orchestrator` after a final customer submission, final quotation send, or explicit user statement that an RFQ project is finished, use this pattern to clean up monitoring rows only:

1. Resolve the exact `rfq_id`, RFQ reference, `company_id`, and `user_id` before any delete.
2. Inspect the live schemas for `scheduled_tasks` and `rfq_watch_targets`.
3. Select candidate rows using `rfq_id` when the column exists. If `rfq_id` is not present, use only clearly linked task/watch identifiers, Gmail thread or message ids, RFQ reference, or subject values that were created for the finished RFQ.
4. Report the scoped rows or counts before deletion and require explicit delete approval unless the user already approved final cleanup including watch cleanup.
5. Delete only the scoped finished-RFQ rows from `rfq_watch_targets` and `scheduled_tasks` on the main branch, with `company_id` and `user_id` filters when those columns exist.
6. Re-query after deletion and report deleted, skipped, and error counts.

Do not use final watch cleanup to delete RFQ history or bid data from `rfq_analysis`, `rfq_items`, supplier tables, pricing tables, compliance tables, quotation tables, selected-offer tables, incoming emails, email events, or final-package records.

### 7. Schema Repair

If a needed table or column is missing:

1. Confirm the gap with live Neon schema tools.
2. Prepare a migration on a temporary branch using Neon migration tooling.
3. Verify the migration on the temporary branch.
4. Ask for explicit approval before applying to main.
5. Apply approved schema changes to main only.
6. After applying, re-inspect the main branch schema.

Do not use direct production DDL unless the user explicitly approves the exact change and risk.

## Safety Rules

- Read-only searches may run on the main branch without extra confirmation only after tenant identity is resolved when the table is tenant-scoped.
- Inserts and scoped updates may run on the main branch when the user asked for persistence, the target row identity is clear, and tenant identity came from active signup state or a complete explicit pair.
- Deletes always require confirmation.
- Bulk updates always require confirmation.
- Schema changes always require confirmation after temporary-branch verification.
- Ambiguous project, company, user, or customer identity must be surfaced before writing. Ambiguous branch selection should resolve to main for live QuoteFlow operations unless the user explicitly requests another branch.

## Output

When reporting database work, state:

- Neon project/database used.
- Main branch used for live operations, or temporary branch used for migration validation.
- Tables inspected.
- Tenant identity source: active signup JSON, legacy active signup text, or an explicit company/user pair.
- Writes performed or skipped.
- Any schema gaps or migration status.

Do not expose credentials, connection strings, raw tokens, or unrelated table data.
