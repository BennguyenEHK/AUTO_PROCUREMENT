---
name: rfq-analysis
description: Analyze industrial procurement RFQs from Gmail email subjects for the AUTOMATE_PROCUREMENT / QuoteFlow AI workflow. Use when the user asks to analyze, check, run, or process an RFQ email by subject, including prompts such as "Analyze RFQ email subject RFQ 123", "Analyze the Gmail RFQ with subject LDVA-INS-022", "Run RFQ analysis for email subject PRD-26-10090", or references to the rfq_analysis workflow. Orchestrate Gmail lookup, email normalization, attachment parsing, existing incoming_emails and rfq_analysis persistence, model-routing-policy guided Abacus AI RFQ summary, canonical TypeScript item extractor, per-item functional summaries, and a concise procurement report.
---

# RFQ Analysis

## Purpose

Use this skill to turn one Gmail RFQ email subject into a traceable, concise procurement analysis. Treat this as an orchestration skill: reuse existing Gmail, PDF, document, spreadsheet, image, the built-in Neon Postgres plugin, Abacus AI, and the canonical TypeScript item extractor at `C:\Users\LENOVO\.codex\skills\quoteflow-webapp\tools\item-extract.ts`.

## Web App Navigation

For normal RFQ analysis review, return `http://localhost:3000/?view=documents&tab=technical&rfqId=<id>`. Do not generate or open a standalone RFQ analysis HTML report unless the customer explicitly requires that artifact; verify any required standalone path before returning it.

Required input: `rfq_email_subject`.

Optional inputs: `company_id`, `user_id`, `force_reprocess` with default `false`.

## Workflow Stage

- Stage: `rfq_analysis`
- Previous stage: `new` or no persisted RFQ stage.
- Next stage: `rfq_analysis_review` for user validation. `tender_document_intake` may follow when tender files/forms need deeper intake. `supplier_search` must not be selected directly by default.
- Stage owner: `bid-package-orchestrator`.
- State persistence: after successful analysis, customer/item persistence, and readable RFQ Analysis Report generation, use `quoteflow-neon` to update stage fields when the target RFQ row is clear. On success, append this stage to `completed_stages`, set `current_stage = rfq_analysis_review`, set `stage_status = pending_user_validation` when available or `needs_review` when that is the supported status, set `stage_blockers = user_validation_pending`, and set `next_required_action = user must review RFQ Analysis Report and approve/proceed to supplier search`. On block, do not advance `current_stage`; set `stage_status = blocked`, populate `stage_blockers`, and set `next_required_action` to the unblock action.
- Boundary: this skill extracts and analyzes RFQ intake. It should not perform supplier search, pricing, final offer selection, bid form generation, or final packaging.
## Before Running

Before implementing or executing project writes:

- Read `AGENTS.md` and any project-local skill routing.
- Use the built-in Neon Postgres plugin as the primary source for live database schema, table existence, and persistence. Do not depend on local schema files or migrations when Neon is available.
- Locate existing Gmail usage, attachment download helpers, Abacus AI client/model routing, JSON repair utilities, and the canonical item extraction tool at `C:\Users\LENOVO\.codex\skills\quoteflow-webapp\tools\item-extract.ts`.
- Reuse existing code paths and schemas. Do not create duplicate tables, storage systems, Abacus clients, or item extractors.
- If an expected component is absent, continue with the available pieces and clearly report the limitation.

Load supporting references only when needed:

- `references/integration-map.md` for repository inspection targets and component contracts.
- `references/output-contract.md` for final report and JSON validation contracts.

For any database inspection, persistence, schema repair, or Neon work, use the `$quoteflow-neon` skill first. It provides the QuoteFlow Neon project target, default `company_id = 1`, default `user_id = 1`, and database safety rules.

For AbacusAI / ChatLLM model calls, use `$model-routing-policy` first when model tier, privacy, or complexity is unclear, then use `$chatllm-call`. `chatllm-call` provides the local `call_chatllm.ps1` automation wrapper for Abacus CLI setup/login/cache and pass-through model calls. The wrapper returns Abacus CLI output directly, so the RFQ workflow must validate any required JSON before persistence.

Use `scripts/rfq_helpers.py` for deterministic helpers such as safe RFQ workspace names, attachment hashing, duplicate-safe filenames, email body normalization, compact context assembly, and JSON schema checks. Run `python scripts/test_rfq_helpers.py` after changing the helpers.

## Workflow

### 1. Search Gmail

Use the Gmail skill/tools. Search narrowly by exact subject first, conceptually `subject:"<rfq_email_subject>"`. If no exact match exists, retry with normalized subject text after removing common reply/forward prefixes such as `RE:`, `FW:`, `Fwd:`, and `AW:`.

Prefer the original RFQ/request email over later replies unless a later message contains material RFQ changes. Do not select a loosely related email from a keyword match. Preserve Gmail message/thread identifiers internally for traceability, but do not expose them in the final report.

If no reliable message is found, return exactly: `RFQ email not found for subject: <subject>`.

### 2. Fetch And Normalize Email

Fetch structured Gmail data, including subject, sender, recipients, date, body, snippet, thread context, and attachment metadata. Keep structured tool output structured; do not turn it into a long narrative too early.

Maintain separate logical values:

- `raw_email_body`
- `normalized_email_body`

Remove only obvious repeated quoted history, signatures, confidentiality footers, tracking text, social footer links, and repeated banners when safe. Never remove technical or commercial RFQ content such as item descriptions, quantities, manufacturers, model numbers, standards, certificates, deadlines, Incoterms, currency, country-of-origin, or delivery requirements.

### 3. Inspect Neon And Persist Incoming Email

Use `$quoteflow-neon` for database work. First locate the `quoteflow_ai` Neon project when no project is provided. Use the project named `quoteflow_ai` if present; otherwise list/search projects and pick the project that clearly belongs to QuoteFlow/AUTOMATE_PROCUREMENT.

Inspect the live table schema before writing:

- `incoming_emails`
- `rfq_analysis`
- `rfq_items`
- `customers`
- `user_company` when `company_id` resolution is needed

Use `describe_table_schema` or equivalent Neon schema tools as the source of truth. Current known Neon project details from a successful test: project `quoteflow_ai`, project id `wandering-bar-14365580`, main branch id `br-soft-smoke-ahc5mcj6`, database `neondb`. Treat these as hints, not hardcoded requirements.

For `incoming_emails`, map only to real columns. In the tested Neon schema these include `message_id`, `from_email`, `from_name`, `to_recipients`, `cc_recipients`, `subject`, `email_body_text`, `attachments_parsed`, `classification_type`, `classification_confidence`, `rfq_id`, `user_id`, `company_id`, `received_at`, `processed_at`, and `created_at`.

For `customers`, map only to real columns after inspecting the live schema. In the tested Neon schema these include `rfq_id`, `customer_id`, `company_name`, `customer_address`, `phone`, `fax_number`, `attention_person`, `carbon_copy_person`, `email`, `company_id`, and `user_id`. Customer data must be extracted during RFQ intake and upserted or inserted for the same `rfq_id`, `company_id`, and `user_id` when the table exists.

Avoid duplicate records using the live unique constraint on `incoming_emails.message_id` when present. If no unique key exists, use a deterministic identity from Gmail message/thread id, subject, sender, date, and body hash consistent with the database schema.

Do not invent column names or fake identifiers. In the tested Neon schema, `company_id` is required for `incoming_emails`, `rfq_analysis`, and `rfq_items`. Use the `$quoteflow-neon` default context `company_id = 1` and `user_id = 1` unless the user supplies different IDs or live Neon data clearly proves the defaults are wrong.

### 4. Retrieve And Route Attachments

If the RFQ has attachments, download relevant files into the user's Documents directory:

`Documents/QuoteFlowAI/RFQ/<safe-rfq-reference>/incoming/`

Resolve the Documents path from the operating system. Sanitize RFQ directory names and filenames. Prevent path traversal and avoid overwriting distinct attachments with the same filename.

Calculate SHA-256 for each attachment. If the same hash already has valid parsed output and `force_reprocess` is false, reuse cached output. Unknown file types must not crash the workflow; record them as `unsupported_attachment` and mention them only when they may materially affect the analysis.

Route supported files deterministically:

- `.pdf`: use the PDF skill or existing project PDF processing.
- `.jpg`, `.jpeg`, `.png`, `.webp`: use image/specification analysis.
- `.xlsx`, `.xls`, `.csv`: use spreadsheet/table extraction.
- `.docx`, `.doc`, `.txt`: use document/text extraction.

### 5. Parse Attachments Compactly

Do not inject full attachments or full extracted text into the main context. For PDFs, inspect, extract page-referenced text, identify tables, RFQ item sections, technical requirements, commercial terms, deadlines, certifications, and visual/scanned pages requiring image inspection. Return compact structured parsed results with filename and page references wherever possible.

PDF attachment handling:

1. Access PDF attachments through the source connector first, such as Gmail `read_attachment`, Drive export/read output, or the project file source.
2. Inspect the connector-provided readable content, page text, document structure, and attachment metadata before invoking separate PDF rendering.
3. If required procurement fields can be extracted with high confidence from readable text and document structure, continue without rendering the full PDF or calling the PDF skill only for duplication.
4. Invoke the `pdf` skill/plugin and visually inspect relevant pages when the PDF contains or may contain scanned pages, technical drawings, datasheet tables, checkboxes, diagrams, specification images, stamps or signatures, visually encoded selections, complex multi-column layouts, or ambiguous extracted text.
5. Render only pages relevant to unresolved procurement requirements. Do not render the entire PDF unless the unresolved requirement spans the whole document or page selection is unsafe.
6. Cross-check visually derived values against extracted text before finalizing normalized RFQ requirements. Mark conflicts as `TECHNICAL DEVIATION`, `MISSING INFORMATION`, or `CLARIFICATION REQUIRED` as appropriate.

For visual or image-based RFQ content, use `$chatllm-call` with the most suitable low-token AbacusAI / ChatLLM image-analysis model available for detailed and accurate technical specification descriptions. Do not send private RFQ images to external model endpoints unless the user has authorized that data transfer or the endpoint is approved for the workflow; otherwise use local/source text and report the limitation.

For images or scanned pages, extract only visible text and specifications. Mark unreadable or uncertain values as low confidence or clarification notes. Do not invent specifications.

### 6. Build RFQ Context Package

Merge normalized email body, relevant thread context, parsed attachments, and source references into one compact RFQ context package. Deduplicate repeated content across forwarded chains, email body, and attachments. Preserve manufacturer names, model numbers, part numbers, SKUs, tag numbers, and product codes verbatim.

Include:

- RFQ subject and sender identity.
- Normalized RFQ content.
- Deadline-related text.
- Commercial, technical, and special requirements.
- Candidate item sections.
- Source references by filename/page/email date where available.

### 7. Analyze RFQ With Abacus AI

Use `$model-routing-policy` and `$chatllm-call` for AbacusAI / ChatLLM model calls unless a stronger project-local integration already exists and is clearly wired. Prefer the `call_chatllm.ps1` entrypoint with normal Abacus CLI arguments such as `--model <model> -p "<prompt>"`. Do not add new API keys for this CLI workflow.

Send the compact context package using this semantic prompt:

```typescript
ANALYZE_RFQ_PROMPT = `You analyze RFQ emails. Return ONLY valid JSON, no markdown.

Output schema:
{
  "rfq_analysis": {
    "subject": "RFQ Analysis - [topic]",
    "analysis_content": "Summary: what client wants, key requirements, deadlines, closing_time, clarification needed",
    "analysis_status": "completed",
    "special_requirements": {
      "certificates_compliance": [],
      "submission_proposal": [],
      "signature_authorization": [],
      "delivery": [],
      "commercial_terms": [],
      "technical_standards_inspection": [],
      "documentation": [],
      "coo_origin": [],
      "manufacturer_authorization": [],
      "commercial": [],
      "technical": [],
      "submission": [],
      "compliance": [],
      "source_refs": []
    },
    "required_documents": {
      "certificates": [],
      "bid_documents": [],
      "shipping_documents": [],
      "invoice_backup": [],
      "source_refs": []
    },
    "clarifications": []
  },
  "customer_partial": {
    "company_name": "Full legal company name",
    "customer_address": "Full mailing address"
  }
}

Rules:
- rfq_analysis.subject: concise title for this RFQ.
- rfq_analysis.analysis_content: summarize scope, key requirements, deadlines, compliance notes, anything needing clarification, added <br> tags to separate the distinct sections for better readability.
- rfq_analysis.analysis_status: always "completed".
- rfq_analysis.special_requirements: source-supported RFQ-level requirements outside ordinary item description and quantity. Extract from the merged email body, thread context, parsed attachments, technical specifications, and PDF/source references. Return clean grouped arrays whenever present:
  - certificates_compliance: CO, CQ, certificate of compliance, manufacturer certificates, calibration/test certificates, conformity certificates, and certificate standards.
  - submission_proposal: inquiry number, PR number, RFQ number, required proposal wording, proposal format, bid forms, technical/commercial separation, submission instructions, and required references to include in the offer.
  - signature_authorization: authorized signature, company stamp/seal, authorized signatory, manufacturer/OEM/distributor authorization.
  - delivery: shortest possible delivery, required delivery date, delivery location, lead-time instruction, delivery deadline when separate from quotation closing.
  - commercial_terms: Incoterms, currency, validity, payment terms, taxes, warranty, freight, bid bonds, commercial conditions.
  - technical_standards_inspection: standards, inspection, testing, datasheet/spec compliance, material/test requirements outside normal item description.
  - documentation: datasheets, drawings, manuals, MTR, QA/QC documents, shipping documents, invoice backup, other document packs.
  - coo_origin: country-of-origin declarations or origin restrictions.
  - manufacturer_authorization: explicit manufacturer/OEM/distributor authorization requirements when not already captured under signature_authorization.
  Keep commercial, technical, submission, and compliance buckets as broader compatibility groupings when useful. If a requirement is broad or vague, preserve the wording and also add a clarification.
- rfq_analysis.required_documents: source-supported certificates, bid forms, commercial/technical proposal files, shipping data, invoice backup, manufacturer documents, and other RFQ document requirements.
- rfq_analysis.clarifications: source-supported gaps, conflicts, unreadable specifications, visual/PDF ambiguities, and missing information. Use [] when none are identified.
- For the three structured persistence fields, use exactly these JSON keys: `special_requirements`, `required_documents`, and `clarifications`. Do not use misspelled or singular variants such as `special_requirement`, `required_document`, or `clarification`.
- If a structured bucket has no source-supported values, return the empty object/array shape from the schema rather than omitting the key.
- customer_partial.company_name: extract the full legal company name of the SENDER (not the recipient).
- customer_partial.customer_address: extract the mailing address of the SENDER's company ONLY (the company in the From header / from_email domain). If the body or attachment contains an address belonging to a DIFFERENT organization, DO NOT return that address. Return "" instead and surface a clarification note in analysis_content.
- If a field is not found, use empty string "".
- Do NOT extract: email, phone, fax, items, quantities - these are handled separately.`;
```

Validate JSON before using it. Required: top-level `rfq_analysis`, `rfq_analysis.analysis_status == "completed"`, `customer_partial`, and the structured RFQ-level keys `rfq_analysis.special_requirements`, `rfq_analysis.required_documents`, and `rfq_analysis.clarifications`. Use existing JSON repair/retry utilities when available. Never write malformed or fabricated AI output.

### 8. Extract And Analyze Items

Call the canonical TypeScript item extraction tool at `C:\Users\LENOVO\.codex\skills\quoteflow-webapp\tools\item-extract.ts` after confirming it exists. It contains only deterministic RFQ item extraction: `ExtractedItem`, `extractRfqItems`, pipe-delimited row extraction, and the table state machine. Do not call the full `extractAll()` orchestrator for item-only extraction.

Pass one JSON object with this input contract through stdin. Use `-InputJson` only for short/simple text because long RFQ bodies are safer through stdin:

```json
{
  "email_body_content": "normalized RFQ email body or strongest item-source text",
  "from_email": "sender@example.com",
  "from_name": "Sender Name",
  "cc": ["cc@example.com"],
  "attachment_text": "best-ranked attachment text for contact fields",
  "user_full_name": "logged-in user full name when known"
}
```

For the first implementation, provide `normalized_email_body` as `email_body_content`. If parsed attachment item sections are later proven stronger, merge them into the string before calling the tool, but keep the field name `email_body_content` so the tool contract remains stable. Provide Gmail sender/CC metadata and the best-ranked attachment text whenever available so the tool can return deterministic customer contact fields.

The tool must return this output contract:

```json
{
  "success": true,
  "items": [
    {
      "item_id": 1,
      "company_description": "verbatim item description",
      "qty": 4,
      "uom": "EA"
    }
  ],
  "rfq_items": [
    {
      "item_id": 1,
      "company_requirement": {
        "company_description": "verbatim item description",
        "qty": 4,
        "uom": "EA"
      }
    }
  ],
  "customer_partial": {
    "email": "sender@example.com",
    "attention_person": "Customer contact person",
    "carbon_copy_person": ["CC contact"],
    "phone": "phone number",
    "fax_number": "fax number"
  }
}
```

On failure or invalid input, the tool must return:

```json
{
  "success": false,
  "items": [],
  "rfq_items": [],
  "error": "short reason"
}
```

Use `rfq_items` as the downstream item array for persistence and item functional summary. Use `items` only when the raw extractor shape is needed for validation or debugging. Preserve manufacturer names, model numbers, part numbers, SKUs, stock numbers, and product codes verbatim from `company_description`.

Use `customer_partial` as the deterministic customer contact extraction output. Merge it with the validated Abacus `customer_partial.company_name` and `customer_partial.customer_address` values before writing the `customers` table. Do not let Abacus overwrite deterministic email, attention, CC, phone, or fax values unless the deterministic value is empty and the replacement is source-supported.

Example call from the AUTOP_PROCUREMENT workspace:

```powershell
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[Console]::OutputEncoding = $utf8NoBom
$OutputEncoding = $utf8NoBom
$payload = @{
  email_body_content = $normalized_email_body
  from_email = $from_email
  from_name = $from_name
  cc = $cc_recipients
  attachment_text = $best_attachment_text
  user_full_name = $user_full_name
} | ConvertTo-Json -Compress
$extractTool = 'C:\Users\LENOVO\.codex\skills\quoteflow-webapp\tools\item-extract.ts'
$payload | node --import tsx $extractTool
```

Merge complementary item information without duplicating the same line item. Preserve the project item schema and retain item id/line number, description, quantity, unit, explicit manufacturer, explicit model/part/SKU, and source.

Analyze every extracted item with `$model-routing-policy` guided `$chatllm-call` or the project model-routing configuration, preferably in batches:

```text
Return ONLY valid JSON with items[].item_id, identification[], classification[], application[], purpose[], features[].
Return one object per input item with the same item_id.
Preserve every manufacturer part number, model code, SKU, and product code verbatim.
Base statements only on the item description and RFQ context.
Use [] for unknown axes and add no extra fields.
```

Validate that the analyzed item count equals the extracted item count and every input `item_id` appears exactly once. Retry or repair according to project conventions if validation fails. If item extraction fails, do not fabricate items; report that RFQ items could not be reliably extracted.

### 9. Determine Required RFQ Answers

Always answer:

- Deadline: quotation deadline/closing date/closing time/submission deadline, delivery deadline if separate, deadline period, and timezone when explicit. Distinguish quotation closing from delivery date. If absent, state `Deadline not identified in the analyzed email or attachments.`
- Each item: concise identification, purpose/application, and key features from extracted and analyzed item data.
- Special/further requirements: only source-supported requirements outside basic item description and quantity, such as COO/origin restrictions, certificates, standards, inspection, documentation, manufacturer authorization, Incoterms, currency, quotation validity, payment terms, bid bonds, and technical/commercial bid forms.

For `Special / Further Requirements`, do not compress unrelated requirements into one paragraph. Present a clean grouped format and include every group that is source-supported by the email body, parsed PDF/technical specification attachments, or other extracted tender documents:

- `Certificates / Compliance`: CO, CQ, certificate of compliance, manufacturer certificates, test/calibration certificates, conformity certificates, certificate standards.
- `Submission / Proposal`: inquiry number, PR number, RFQ number, proposal format, required text/references, bid forms, technical/commercial separation, submission channel or instructions.
- `Signature / Authorization`: authorized signature, stamp/seal, authorized signatory, manufacturer/OEM/distributor authorization.
- `Delivery`: shortest possible delivery, delivery deadline, delivery location, lead time, shipping/delivery instruction.
- `Commercial Terms`: Incoterms, currency, validity, payment terms, warranty, taxes, freight, bid bonds, commercial conditions.
- `Technical Standards / Inspection`: standards, inspections, tests, technical/spec compliance, material/test requirements outside normal item descriptions.
- `Documentation`: datasheets, drawings, manuals, MTR, QA/QC documents, shipping documents, invoice backup, document packages.
- `COO / Origin`: country-of-origin requirements, origin restrictions, origin declarations.
- `Clarification`: broad, vague, conflicting, missing, or unreadable requirement details; for example, "other applicable manufacturer certificates" when no exact certificate list is defined.

When a group has no source-supported values, omit that group from the readable report or state `Not identified` only when the absence is important. Do not invent missing requirements.

### 10. Build Readable RFQ Analysis Report

Before final persistence is considered complete, show a readable RFQ Analysis Report in the canonical technical deep link. This is the user-validation artifact required by `bid-package-orchestrator` before supplier search. Generate a local HTML report only when the customer explicitly requires it.

The report must include:

- RFQ reference or concise title.
- Deadline finding.
- RFQ requirement summary.
- Special/further requirements in clean grouped sections: Certificates / Compliance, Submission / Proposal, Signature / Authorization, Delivery, Commercial Terms, Technical Standards / Inspection, Documentation, COO / Origin, and Clarification when applicable.
- Extracted item table with quantity, unit, identification, purpose/application, and key features.
- Clarifications, missing information, unsupported attachments, or material parsing limits.

Return the canonical technical deep link in the stage handoff. If the web app is unavailable, show the same report in chat; do not create a standalone report unless the customer explicitly requires one. Do not proceed to supplier search from this skill.

### 11. Persist RFQ Analysis

Use `$quoteflow-neon` and the built-in Neon Postgres plugin with existing `rfq_analysis` / `rfq_items` tables. Inspect the real schema first with Neon tools. Known tested columns for `rfq_analysis` include `rfq_id`, `company_id`, `user_id`, `rfq_reference`, `subject`, `analysis_content`, `analysis_status`, `created_at`, `updated_at`, `required_currency`, `deadline_period`, `closing_time`, `current_stage`, `unread_count`, `last_preview_type`, and, when the main schema has been migrated, `special_requirements`, `required_documents`, and `clarifications`.

Known tested columns for `rfq_items` include `id`, `company_id`, `rfq_id`, `user_id`, `company_description`, `qty`, `uom`, `created_at`, `item_id`, and `agent_item_summary`. The tested schema has a unique constraint on `(rfq_id, item_id)`, so use upsert/update behavior for repeated item processing when possible.

Known tested columns for `customers` include `rfq_id`, `customer_id`, `company_name`, `customer_address`, `phone`, `fax_number`, `attention_person`, `carbon_copy_person`, `email`, `company_id`, and `user_id`. After the target RFQ row exists, merge customer fields from the deterministic item tool output and the validated Abacus output, then persist the customer row for the same `rfq_id`, `company_id`, and `user_id`. Use scoped upsert/update behavior when a customer row already exists for the RFQ. If the table or a needed column is missing, report the schema gap; do not silently omit customer persistence.

Map validated Abacus output and extracted deadline/currency fields to actual columns. When the live `rfq_analysis` schema includes the structured JSONB columns, persist RFQ-level buckets as follows:

- `special_requirements`: source-supported requirements outside basic item description and quantity, preserving the clean grouped buckets when present: `certificates_compliance`, `submission_proposal`, `signature_authorization`, `delivery`, `commercial_terms`, `technical_standards_inspection`, `documentation`, `coo_origin`, `manufacturer_authorization`, plus broader `commercial`, `technical`, `submission`, and `compliance` buckets when useful for compatibility.
- `required_documents`: CO, CQ, certificates of compliance, manufacturer certificates, bid forms, proposal files, shipping data, invoice backup, and other required supporting documents.
- `clarifications`: missing information, source conflicts, unreadable specs, unsupported attachments, visual/PDF ambiguities, and blocking procurement questions.

Before writing, verify the live `rfq_analysis` schema on the main QuoteFlow branch. If the schema contains `special_requirements`, `required_documents`, and `clarifications`, write the validated JSON values into those exact columns. If one of these columns is missing, do not silently drop the value; report the schema gap and keep the same content in `analysis_content` as a fallback only.

Keep delivery deadline, shortest-delivery instruction, delivery location, and Incoterms in `deadline_period`, `closing_time`, `analysis_content`, and/or `special_requirements` according to the live schema and whether the value is a deadline or a commercial requirement. Keep item-specific identification, classification, application, purpose, features, and item-specific deviations in `rfq_items.agent_item_summary`. Do not duplicate full item summaries into RFQ-level JSON unless they are also RFQ-level requirements. Follow existing handling for company/user/customer resolution. Do not invent IDs. Avoid duplicate RFQ records by using the project's RFQ identity/update/version behavior.

If a needed table or column is missing, use Neon schema tools to verify the gap. For schema changes, use Neon migration tooling on a temporary branch first and ask for confirmation before applying to the main branch. Do not run destructive or production-changing SQL without explicit user approval.

If the database write fails, do not claim the RFQ was saved. Show the analysis if available and report the persistence failure according to project conventions.

After `rfq_analysis`, `rfq_items`, and `customers` persistence succeeds where the live schema supports them, persist the workflow review gate state:

- `current_stage = rfq_analysis_review`
- `stage_status = pending_user_validation` when supported, otherwise `needs_review`
- `stage_blockers = user_validation_pending`
- `next_required_action = user must review RFQ Analysis Report and approve/proceed to supplier search`
- `completed_stages` includes `rfq_analysis`

If the user explicitly requested `skip`, `auto-run`, `bypass validation`, or `test mode`, this skill may record the bypass instruction for the orchestrator, but it still must produce the readable RFQ Analysis Report and must not itself call supplier search. Approval/bypass advancement is owned by `bid-package-orchestrator`.

## Email Drafting Handoff

If the RFQ analysis leads to an acknowledgement, customer clarification request, supplier question, or any other procurement-facing email, do not draft it directly in this skill. Hand off to `procurement-email-composer` for professional wording, factual safety, QuoteFlow contact lookup through `quoteflow-neon`, and the mandatory chat-visible draft. Use `gmail:gmail` only for Gmail search/read/thread context and for creating or sending a draft after explicit user approval.

## Final User Output

Keep the final answer short, precise, and procurement-focused. Do not expose raw Gmail JSON, raw Abacus JSON, full parsed PDF text, internal IDs, database queries, attachment hashes, routing logs, or token details.

The final answer must be readable as the RFQ Analysis Report for user validation. End with the validation status: supplier search is paused until the user approves/proceeds, unless the user explicitly requested a test-mode skip/auto-run bypass.

Use this format:

```text
RFQ ANALYSIS - <RFQ reference or concise title>

Deadline
<precise deadline finding>

RFQ Requirement
<2-5 sentence concise summary>

Special / Further Requirements
Certificates / Compliance
<source-supported certificate/compliance requirements, or omit if not identified>

Submission / Proposal
<source-supported inquiry number, PR/RFQ reference, proposal format, forms, submission instructions, or omit if not identified>

Signature / Authorization
<source-supported signature, stamp/seal, signatory, OEM/manufacturer authorization requirements, or omit if not identified>

Delivery
<source-supported delivery deadline/location/shortest-delivery/lead-time instructions, or omit if not identified>

Commercial Terms
<source-supported Incoterms, currency, validity, payment, warranty, tax, freight, bid bond, commercial conditions, or omit if not identified>

Technical Standards / Inspection
<source-supported standards, inspections, testing, technical/spec compliance requirements, or omit if not identified>

Documentation
<source-supported datasheets, drawings, manuals, QA/QC, MTR, shipping documents, invoice backup, document packages, or omit if not identified>

COO / Origin
<source-supported country-of-origin requirements or origin restrictions, or omit if not identified>

Clarification
<broad, vague, conflicting, missing, or unreadable requirement details, or omit if none>

Extracted Items

| Item | Qty | Unit | Item Identification | Purpose / Application | Key Features |
|------|-----|------|---------------------|-----------------------|--------------|
| 1 | ... | ... | ... | ... | ... |

Clarification Required
<show only for real ambiguity, conflict, unreadable specification, missing critical information, unsupported material attachment, or failed attachment analysis>

Validation Status
Pending user validation before supplier search. Reply approved/proceed to supplier search to continue.
```

## Failure Rules

- Gmail not found: return the exact not-found message and stop.
- Multiple strong matches: choose by exact subject, original sender, RFQ context, and thread relevance; surface material ambiguity.
- Attachment download failure: continue from email body when possible and state what could not be analyzed.
- PDF parse failure: do not invent content; try scanned/visual analysis where available.
- Abacus failure: use configured retry/error handling and do not persist malformed output.
- item extraction failure: return RFQ-level report and state that items could not be reliably extracted.
- Database failure: do not say the RFQ was saved.
- Missing readable report: do not mark the stage as ready for review until the RFQ Analysis Report has been created or shown in chat.
- Supplier search request: do not run supplier search from this skill; hand control back to `bid-package-orchestrator` for approval handling and stage advancement.

## Context Discipline

Search narrowly, parse locally first, cache by attachment hash, deduplicate forwarded content, send compact context to models, batch item analysis when supported, persist reusable facts, and preserve source provenance for rechecking.
