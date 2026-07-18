# RFQ Analysis Integration Map

Use this reference for component routing. The current skill is an orchestrator. For database state, use `$quoteflow-neon`; Neon is the source of truth when the built-in Neon Postgres plugin is available.

## Inspect First

Search for these component names and nearby equivalents:

- Gmail: `gmail`, `messageId`, `threadId`, `attachmentId`, `downloadAttachment`, `subject:`.
- Incoming email persistence: `incoming_emails`, `incomingEmails`, `IncomingEmail`.
- RFQ persistence: `rfq_analysis`, `rfqAnalysis`, `RfqAnalysis`.
- Abacus AI: `abacus`, `Abacus`, `modelRouter`, `jsonRepair`, `retry`.
- Item extraction: canonical TypeScript tool `C:\Users\LENOVO\.codex\skills\quoteflow-webapp\tools\item-extract.ts`, `extractItems`, `line_items`.
- Database: use `$quoteflow-neon` and the built-in Neon Postgres plugin first. Local `neon`, `postgres`, `pg`, `drizzle`, `prisma`, or `supabase` files are secondary implementation references only.
- Attachment cache: `sha256`, `hash`, `parsed_output`, `attachments`.

Prefer existing service functions over direct SQL or new clients. If only SQL migrations exist, inspect schema before mapping fields.

## Expected Data Flow

1. Gmail search returns candidate messages or threads.
2. Selected message fetch returns structured headers, body, thread context, and attachment metadata.
3. Email normalization produces raw and normalized bodies.
4. Neon schema tools inspect `incoming_emails`; an upsert stores traceable source metadata only after required identifiers such as `company_id` are resolved.
5. Attachments are downloaded to `Documents/QuoteFlowAI/RFQ/<rfq>/incoming/`.
6. Attachment parser returns compact source-referenced facts.
7. RFQ context package feeds Abacus AI RFQ-level JSON analysis.
8. `normalized_email_body` is passed to the canonical TypeScript tool `C:\Users\LENOVO\.codex\skills\quoteflow-webapp\tools\item-extract.ts` as `email_body_content`; the tool returns raw `items` plus downstream-shaped `rfq_items`.
9. Item summaries are validated against extracted item ids.
10. Neon schema tools inspect `rfq_analysis` and `rfq_items`; upserts store validated RFQ-level fields and item rows, linking back to source records when supported.

## TypeScript Integration Expectations

When TypeScript code is present, add only the smallest necessary orchestration wrapper. A typical wrapper should:

- Accept `rfqEmailSubject`, optional `companyId`, optional `userId`, and optional `forceReprocess`.
- Call existing Gmail, persistence, Abacus, attachment, and item extraction services.
- Return a structured result for final report rendering.
- Validate all model JSON before persistence.
- Avoid schema changes unless a migration is clearly required by existing architecture.

The canonical item extraction tool lives at `C:\Users\LENOVO\.codex\skills\quoteflow-webapp\tools\item-extract.ts` and accepts stdin JSON as the preferred input:

```json
{ "email_body_content": "..." }
```

The tool implementation is the item-only extraction code, not the full `extractAll()` pipeline. Invoke it through the webapp's installed `tsx` loader:

```powershell
$extractTool = 'C:\Users\LENOVO\.codex\skills\quoteflow-webapp\tools\item-extract.ts'
$payload | node --import tsx $extractTool
```

## Neon Persistence Mapping

Treat database schemas as dynamic and inspect them through the built-in Neon plugin before writing:

- Use `list_projects` or `search` to locate the QuoteFlow Neon project.
- Use `describe_project`, `describe_branch`, and `describe_table_schema` to find the active branch/database and real table columns.
- Use `run_sql` only for read-only checks unless the user has approved a write.
- Map only to real columns.
- Preserve Gmail/source identifiers internally if existing columns allow it.
- Avoid duplicate records by using existing unique keys or deterministic source identity.
- Do not invent `company_id` or `user_id`; leave unresolved values null only if the schema allows it.

Known tested Neon context:

- Project name: `quoteflow_ai`
- Project id: `wandering-bar-14365580`
- Main branch id: `br-soft-smoke-ahc5mcj6`
- Database: `neondb`
- Relevant tables: `incoming_emails`, `rfq_analysis`, `rfq_items`, `user_company`

These values are hints from one successful test, not permanent configuration. Re-check Neon when running the workflow.

## Attachment Workspace Rules

Resolve the Documents directory from the OS/user profile instead of hardcoding a username. Use `QuoteFlowAI/RFQ/<safe-rfq-reference>/incoming/`. Sanitize all path segments and filenames. If two attachments share a filename but differ in content, keep both with a deterministic suffix.
