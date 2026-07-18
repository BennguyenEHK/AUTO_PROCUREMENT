---
name: bid-package-orchestrator
description: Orchestrate the end-to-end industrial tender workflow from RFQ/RFP/ITT intake through selected offer, bid forms, technical documents, QA, final Technical Proposal and Commercial Proposal folders, ZIP files, QA report, and customer cover email. Use when Codex needs to coordinate multiple QuoteFlow procurement skills to produce a complete bid-ready submission package rather than only analysis, sourcing, pricing, or reports; when customer or supplier replies require a reply-impact review against prior requirements, offers, clarifications, selected offers, pricing, documents, or QA state; also use model-routing-policy when choosing worker/model complexity for delegated procurement tasks.
---

# Bid Package Orchestrator
## Local Artifact Links

When returning local artifacts, first verify the exact file exists and is non-empty. Resolve the actual absolute Windows path; for HTML/report previews provide a browser-safe `file:///C:/...` or `file:///D:/...` URL plus the Windows path. Never return placeholder, relative, stale, `/mnt/c/...`, or `C:/mnt/c/...` links.

When editing this `SKILL.md` or other workflow Markdown/control files, preserve UTF-8 without BOM and verify no BOM after edits when practical.

## Purpose

Coordinate the complete tender-to-submission workflow. This skill owns sequencing, readiness gates, dependency routing, reply-impact gates, and final completion criteria.

This skill owns the control question: "A customer or supplier replied; what changed, which historical sources must be loaded, which specialist review must run, and can the bid safely continue?" It also owns the mandatory user-validation gate between RFQ analysis and supplier search. It does not replace the specialist technical, certificate, commercial, or QA judgment skills.

Use this skill when the user asks for a full bid package, formal tender submission, technical/commercial proposal folders, final package ZIPs, or a workflow that must continue beyond RFQ analysis.

The workflow is complete only when the required final outputs exist or a blocker is explicitly reported.

## Separate RFQ Task Gate

Use this gate when checking email, watches, or inbox triage finds a new original customer RFQ while another RFQ workflow is active in the current task.

Do not process unrelated new original RFQs inside the current RFQ task. A new original customer RFQ means a new procurement request, inquiry, PR, tender, or quotation request that is not a reply, clarification, supplier response, addendum, or continuation for the current RFQ.

For every unrelated new RFQ:

1. Resolve the new RFQ subject, customer, visible RFQ/PR/reference, message date, and Gmail/thread/source reference.
2. Create a separate Codex task in the same project when the Codex thread tool is available. Use `list_projects` first, then `create_thread` with the same project/local environment.
3. The new task prompt must explicitly activate this skill and contain:
   - `Use $bid-package-orchestrator`;
   - the new RFQ email subject and source reference;
   - customer/RFQ/PR reference if detected;
   - instruction to start at RFQ analysis/intake;
   - instruction that this is a separate RFQ workflow and must not mix artifacts, suppliers, pricing, approvals, or watches with the current RFQ.
4. Continue the current RFQ task only for the current RFQ. Report the created task reference or, if task creation is unavailable, report that a separate task must be opened before processing the new RFQ.

Never merge multiple original RFQs into one task just because they were discovered in the same inbox check. Replies or addenda for the current RFQ stay in the current task and go through the Customer/Supplier Reply Impact Gate.

## Artifact Cleanup Manifest

Initialize an RFQ cleanup manifest as soon as the RFQ identity is known, before generating stage artifacts when practical.

Manifest folder:

```text
C:\Users\LENOVO\.codex\skills\bid-package-orchestrator\cleanup-manifest
```

Active manifest path:

```text
C:\Users\LENOVO\.codex\skills\bid-package-orchestrator\cleanup-manifest\<safe-rfq-reference>.json
```

Completed receipt folder:

```text
C:\Users\LENOVO\.codex\skills\bid-package-orchestrator\cleanup-manifest\completed
```

Use filesystem-safe RFQ names by replacing characters outside letters, numbers, dash, underscore, and dot with `_`. Write manifest and receipt JSON as UTF-8 without BOM.

Initial active manifest shape:

```json
{
  "rfq_reference": "PRD-25-PR-10337",
  "rfq_id": 1,
  "status": "active",
  "created_at": "2026-07-15T00:00:00Z",
  "artifacts": []
}
```

Every skill or stage that creates a local JSON, HTML, report, preview, proposal, ZIP, validation file, or package file must append an artifact entry or report the path to this orchestrator so it can append one. Do not rely on later filesystem scanning as the primary cleanup source.

Artifact entry shape:

```json
{
  "path": "C:\\path\\to\\artifact.json",
  "type": "json",
  "stage": "commercial_pricing",
  "purpose": "pricing-input",
  "retention": "delete_after_final_send",
  "created_at": "2026-07-15T00:00:00Z",
  "safe_to_delete": true,
  "must_keep": false
}
```

Allowed retention values:

- `keep_final`: final customer-facing proposal, sent-email proof, final QA, final package, signed forms, or final customer submission evidence.
- `archive_after_final_send`: approved pricing JSON, selected-offer freeze, audit evidence, or files useful for later review.
- `delete_after_final_send`: intermediate reports, temporary previews, validation JSON, generated scratch JSON, or superseded HTML.
- `delete_after_persistence`: low-risk scratch transform files only; never approval evidence.
- `never_delete_without_user_approval`: final package, customer-facing proposal, signed forms, sent-email proof, legal/customer-prescribed forms, or anything uncertain.

## Final Cleanup Gate

Use this gate only after a final customer technical/commercial proposal, bid submission, or normal sales quotation email has been sent successfully, or when the user explicitly says the RFQ project is finished.

1. Load the RFQ active cleanup manifest.
2. Verify final customer-facing outputs and sent-email proof are marked `keep_final` or `never_delete_without_user_approval`.
3. Ask the user which cleanup mode to apply unless they already gave explicit cleanup instructions:
   - archive intermediate files;
   - delete intermediate files;
   - keep everything.
4. Do not delete Neon database rows during local artifact cleanup. Database retention/purge is a separate explicit workflow.
5. Do not delete files whose retention is `keep_final`, `never_delete_without_user_approval`, or uncertain.
6. For approved archive/delete actions, operate only on paths listed in the manifest and verify each path exists before acting. Report missing files rather than guessing.
7. Create a cleanup receipt in:
   ```text
   C:\Users\LENOVO\.codex\skills\bid-package-orchestrator\cleanup-manifest\completed\<safe-rfq-reference>-cleanup-receipt.json
   ```
   The receipt must include cleanup date, mode, kept files, archived files, deleted files, skipped files, and any errors.
8. After the receipt is written, clear the active manifest by deleting it or overwriting it with:
   ```json
   {
     "rfq_reference": "PRD-25-PR-10337",
     "rfq_id": 1,
     "status": "cleaned",
     "artifacts": []
   }
   ```

Prefer archive over delete when evidence value is uncertain.

## Final Watch Cleanup Gate

Use this gate only after a final customer technical/commercial proposal, bid submission, or normal sales quotation email has been sent successfully, or when the user explicitly says the RFQ project is finished.

This is a database watch-cleanup step, separate from local artifact cleanup. It may delete only RFQ monitoring records that no longer need to run after the RFQ is finished. It must not delete RFQ business history, supplier evidence, pricing, compliance, selected-offer, quotation, or final submission records.

1. Resolve the exact `rfq_id`, RFQ reference, `company_id`, and `user_id` through `quoteflow-neon`.
2. Inspect the live schemas for `scheduled_tasks` and `rfq_watch_targets` before deletion.
3. Find rows related to the finished RFQ using `rfq_id` when available. If a table does not have `rfq_id`, use only clearly linked watch identifiers such as task id, watch target id, Gmail thread/message id, RFQ reference, or subject values that were created for this RFQ.
4. Show or record the scoped row counts and identifiers before deletion. If the user has not already approved final cleanup including watch cleanup, ask for explicit approval before deleting database rows.
5. Delete only the scoped rows from `rfq_watch_targets` and `scheduled_tasks` through `quoteflow-neon`, on the main branch, using the narrowest available filters.
6. Recheck the tables after deletion and include deleted/skipped/error counts in the cleanup receipt or final summary.
7. If the RFQ identity is ambiguous, if rows may belong to another RFQ, or if the live schema cannot be inspected, skip deletion and report the blocker.

When the QuoteFlow Neon TypeScript helper is available and the RFQ identity is clear, prefer this dry-run/apply sequence through `quoteflow-neon`:

```powershell
npm run db -- cleanup-watch --rfq-id <rfq_id> --dry-run
npm run db -- cleanup-watch --rfq-id <rfq_id> --apply
```

Only run `--apply` after showing the scoped counts or safe identifiers and receiving explicit cleanup/delete approval. Record deleted, skipped, and error counts in the cleanup receipt.

Approved watch cleanup is the only normal final-stage exception to the rule that local artifact cleanup must not delete Neon database rows.

## Setup Preflight Gate

At the first invocation in a Codex task, or whenever the user says `setup`, run this local, read-only setup preflight before signup or ordinary workflow work:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:\Users\LENOVO\.codex\skills\bid-package-orchestrator\signup\setup-preflight.ps1
```

The preflight resolves the sibling `quoteflow-webapp` package by its `package.json` identity. It locates Node.js and npm with `where.exe`; if either is missing, it installs Node.js LTS (which includes npm) through WinGet, refreshes `PATH`, and verifies both commands again. It then runs `npm ci`, validates non-secret local env-file presence and `DATABASE_URL` without displaying it, runs `npm run build`, runs `npm run db -- ping` as a read-only database check, and starts the production web app at `http://localhost:3000/`. Its `signup_state_path` result identifies the non-secret state record in the web app home. It must never apply migrations, write business data, or persist credentials. Stop at a failed preflight and report the precise blocker; do not enter signup or the normal RFQ workflow.

## Signup Bootstrap Gate

Before any ordinary bid-package workflow step, check the local signup state written by the QuoteFlow web app:

```text
C:\Users\LENOVO\.codex\skills\quoteflow-webapp\SIGNUP.json
```

Expected default content:

```text
{
  "signup": false,
  "user_id": null,
  "company_id": null
}
```

If `signup` is `true` and both `user_id` and `company_id` are populated, continue the workflow and let `quoteflow-neon` use those values as the QuoteFlow identity context.

If `signup` is `false`, the file is missing, or either ID is empty:

1. Stop before RFQ database writes.
2. Prefer the local QuoteFlow web app signup screen:
   ```text
   C:\Users\LENOVO\.codex\skills\quoteflow-webapp
   ```
    Setup preflight already starts it. Open:
    ```text
    http://localhost:3000/
    ```
   Use the Signup section to create the company/user records. The server action validates the username, inserts `user_company` then `user_info`, receives both database IDs, and atomically writes `SIGNUP.json` in the web app.
3. The state file must contain only `signup`, `user_id`, `company_id`, optional `username`, optional `company_name`, and `updated_at`. It must never contain passwords, password hashes, connection strings, or any other credential material.
4. Do not offer `signup.html` or `signup-save-helper.ps1`; this retired fallback must not be restarted. `SIGNUP.json` is the only canonical identity file and must never be manually created or edited.

If the web-app signup insert fails, it must not create an active state. Report the blocker and keep the normal workflow paused.

## Database-First Stage Check

Always start by using `quoteflow-neon` to inspect the relevant `rfq_analysis` record before deciding which downstream skill to call.

All database fetching, schema inspection, persistence, and workflow-state updates must be routed through `quoteflow-neon`. Do not fetch QuoteFlow Neon data directly from this skill or depend on local schema notes when a live database check is available.

Activate `rfq-workflow-learner` in background observation mode after the initial RFQ identity/database-stage check for end-to-end RFQ or bid-package work. The learner observes stage handoffs, user corrections, email approvals, blockers, and recurring workflow patterns, but it must not interrupt active work or implement skill/schema/routing changes without explicit user approval.

Persistence-first rule: before processing any new customer, supplier, OEM, manufacturer, distributor, or internal reply, persist or upsert the source message/file event through `quoteflow-neon`. For email replies, save `incoming_emails` by `message_id` when available, link the correct `rfq_id`, and write `rfq_email_events` when that table exists. Do not run the reply-impact gate until storage succeeds or a precise persistence blocker is recorded.

Read these fields when they exist:

- `current_stage`
- `stage_status`
- `next_required_action`
- `stage_blockers`
- `completed_stages`
- `analysis_status`
- `special_requirements`
- `required_documents`
- `clarifications`

Use the `quoteflow-neon` database state first, then apply the user's current request as an override or refinement. Do not rely on chat context alone when a matching RFQ record exists.

If `current_stage` is null, empty, missing, or clearly still at a new/intake state, default to analysis first:

1. If the user asks to analyze an RFQ, package, tender, email, attachment, or document set, call `rfq-analysis` or `tender-document-intake` before later-stage skills.
2. If the source is a Gmail subject or email thread, call `rfq-analysis`.
3. If the source is uploaded/local/Drive tender files, call `tender-document-intake`.
4. After RFQ analysis succeeds, require the RFQ Analysis Review Gate before supplier search. Persist the readable RFQ Analysis Report reference and update or request persistence of `current_stage = rfq_analysis_review`, `stage_status = pending_user_validation` or `needs_review`, `next_required_action = review RFQ Analysis Report and approve before supplier search`, `stage_blockers = user_validation_pending`, and `completed_stages` through `quoteflow-neon`.
5. After tender-document intake succeeds, update or request persistence of `current_stage`, `stage_status`, `next_required_action`, `stage_blockers`, and `completed_stages` through `quoteflow-neon` according to the intake result and downstream readiness.

Treat `current_stage` as the workflow pointer, not proof of completion. Before advancing, verify the current stage's required artifacts and status. If `stage_status` is `blocked` or `needs_review`, resolve or report `stage_blockers` before calling downstream skills. If `next_required_action` is present and consistent with the user's request, prioritize it.

## Model Switch Gate

Before routing a stage, dispatching workers, or calling `$chatllm-call`, use `model-routing-policy` to choose the lightest safe model/reasoning route.

Default ordinary orchestration to a low-reasoning route. Escalate only the affected stage when the work involves ambiguous RFQ requirements, conflicting customer/supplier evidence, technical compliance, selected-offer choice, pricing risk, certificate/origin compliance risk, or final QA.

When the active surface supports GPT model selection, follow the `model-routing-policy` GPT switch defaults:

- routine orchestration: `gpt-5.6-terra`, `low`;
- simple scheduled/cleanup/status work: `gpt-5.6-luna`, `low`;
- normal RFQ analysis/intake/normalization: `gpt-5.6-terra`, `medium`;
- technical compliance, selected offer, pricing risk, or final QA: `gpt-5.6-sol`, `medium` or `high`;
- `xhigh` only for serious unresolved final blockers.

After a high-reasoning specialist decision is complete, return the orchestrator to the lighter default for routine stage control.

## Stage Routing Map

Use this map immediately after reading `rfq_analysis.current_stage` through `quoteflow-neon`:

| `current_stage` value | Primary skill to call | Expected next stage |
| --- | --- | --- |
| empty, null, `new`, `report_analysis`, `rfq_analysis`, `intake` | `rfq-analysis` for Gmail RFQs, or `tender-document-intake` for file/tender packages | `rfq_analysis_review` after RFQ analysis, or `tender_document_intake` for file/tender intake |
| `rfq_analysis_review` | Show the persisted readable RFQ Analysis Report and wait for user approval, especially when `stage_status = pending_user_validation` or `needs_review`; do not call supplier search by default | `supplier_search` only after explicit approval |
| `tender_document_intake` | `tender-document-intake` | `supplier_search`, or `technical_compliance_review` if supplier offers already exist |
| `supplier_search`, `ready_for_sourcing` | `suppliers-search` | `supplier_quote_normalization` |
| `supplier_quote_normalization`, `ready_for_quote_normalization` | `supplier-quotation-normalizer` | `technical_compliance_review` |
| `technical_compliance_review`, `ready_for_compliance` | `technical-compliance-review` | `certificate_origin_review` or `commercial_pricing` |
| `certificate_origin_review` | `certificate-origin-review` | `commercial_pricing` or `selected_offer` |
| `commercial_pricing` | `comercial-pricing` | `selected_offer` only after user-approved pricing canvas/review packet and persisted pricing |
| `selected_offer`, `ready_for_selection` | `selected-offer-manager` | `bid_forms_generation` |
| `bid_forms_generation`, `ready_for_forms` | `bid-forms-generator` | `submission_qa`, or rollback to `selected_offer` / `technical_compliance_review` if forms expose gaps |
| `submission_qa`, `ready_for_qa`, `packaging` | `submission-qa-packager` | `ready_for_submission` or `blocked` |
| `ready_for_submission` | no stage skill unless user asks for revision or resend | final delivery complete |
| `blocked` | resolve `stage_blockers` with the narrowest relevant skill | stage depends on blocker |

If `stage_status` is `blocked` or `needs_review`, do not skip forward. Resolve `stage_blockers` first, then update the workflow state through `quoteflow-neon`.
## Readiness Gates

Use these gates to avoid generating final customer-facing documents from draft or conflicting data:

- `READY FOR INTAKE`: tender files, email subject, Drive folder, or local artifact source is known.
- `READY FOR RFQ ANALYSIS REVIEW`: `rfq_analysis`, `rfq_items`, and `customers` have been persisted where tables exist, and a readable RFQ Analysis Report artifact has been generated or shown to the user.
- `PENDING USER VALIDATION`: RFQ analysis is complete but supplier search must not run until the user approves the RFQ Analysis Report, except in explicit test-mode skip/auto-run requests.
- `READY FOR SOURCING`: customer requirements and technical groups are structured enough for supplier search/RFQ, and the user has approved the RFQ Analysis Report or explicitly requested a test-mode skip/auto-run bypass.
- `READY FOR QUOTE NORMALIZATION`: supplier offers or quote files are available.
- `READY FOR COMPLIANCE`: customer requirement baseline and normalized supplier offers are available.
- `READY FOR SELECTION`: technical and certificate/origin inputs are sufficient, and final pricing is either not required yet or has passed the `comercial-pricing` user-approved pricing canvas/review packet gate with persisted `quotation_pricing` and `quotations.total_amount`.
- `READY FOR FORMS`: selected-offer dataset is frozen.
- `READY FOR QA`: required bid forms and technical attachments exist.
- `READY FOR SUBMISSION`: final folders, ZIPs, QA report, and cover email exist with no `CRITICAL` issue.
- `BLOCKED`: required evidence, user approval, source files, database state, or pricing/signature data is missing.

## Customer/Supplier Reply Impact Gate

Use this gate whenever a new customer, supplier, OEM, manufacturer, distributor, or internal reply is received through Gmail, Drive, local files, user-provided text, or an active `rfq_watch`.

Treat each new reply as a workflow-change event before treating it as a simple message summary.

This gate must not blindly run `supplier-quotation-normalizer`, `technical-compliance-review`, and `certificate-origin-review` as a fixed bundle. First decide which fields changed, then call only the affected specialist skills in the dependency order below. Each called skill must persist its structured result or record a blocker before the workflow can advance.

1. Resolve the RFQ identity, party type, message/thread/file source, response date, and latest checkpoint.
2. Persist the source reply/event through `quoteflow-neon` before review. For email, upsert `incoming_emails` and link `rfq_id`; add `rfq_email_events` when available.
3. Load the relevant prior history through the owning tools and skills:
   - customer requirement baseline, tender addenda, customer clarifications, and submission instructions;
   - normalized supplier offers, revised quotations, supplier clarifications, assumptions, exclusions, and quote validity;
   - previous technical compliance matrices, deviation registers, certificate/origin matrices, selected-offer records, pricing state, generated forms, and QA blockers when they exist.
4. Decide whether the reply is meaningful for the bid. Meaningful changes include new or changed specifications, quantities, technical clarifications, accepted or rejected alternatives, certificates, origin, documentation, lead time, warranty, validity, Incoterm, price, exclusions, commercial terms, approvals, rejections, or submission instructions.
5. For a customer reply with new or changed requirements, update or refine the customer baseline through `tender-document-intake` or `rfq-analysis` when needed, then route to `technical-compliance-review` to compare current supplier offers or selected offers against the latest customer baseline. Also route to `certificate-origin-review`, `supplier-quotation-normalizer`, `comercial-pricing`, `selected-offer-manager`, `bid-forms-generator`, or `submission-qa-packager` when the changed requirement affects those areas.
6. For a supplier reply with a revised quotation, changed offer, price, quantity, UOM, delivery, validity, Incoterm, warranty, exclusion, alternate model, or commercial basis, route first to `supplier-quotation-normalizer`. Do not call `technical-compliance-review` or `certificate-origin-review` as completed downstream stages until quote normalization has produced a structured handoff or a blocker.
7. After supplier quote normalization, call `technical-compliance-review` only when the reply affects technical fit, offered model/P/N/description, quantity/UOM, datasheet, drawing, alternative, deviation, or a customer technical requirement. Call `certificate-origin-review` only when certificates, origin, documentation, manufacturer authorization, bid-stage/delivery-stage documents, or certificate cost/availability are affected. These two reviews may run in parallel only after normalized quote data exists and their scopes are independent; final advancement remains blocked until both required reviews complete.
8. If any affected specialist stage reports `blocked`, `needs_review`, missing evidence, unmapped lines, insufficient numerical proof, or failed persistence, stop the sequence immediately and produce the response-impact report with the blocker and next required action. Do not continue to pricing, selected offer, forms, QA, or submission.
9. For numerical reply content, require the owning specialist skill to provide the calculation method and graph/table proof when the number affects compliance, pricing, quantity, validity, lead time, or QA. The orchestrator records that the numerical proof was requested and blocks advancement if a material proof is missing.
10. Produce or request one combined Response Impact Report after the affected specialist sequence finishes, or immediately when a blocker stops the sequence. Use `report-generator` and include separate sections for every called skill rather than merging conclusions into an untraceable summary. Generate standalone HTML only when the customer explicitly requires it. The report must contain:
   - new response source and prior checkpoint;
   - affected customer items, fields, stages, and documents;
   - opposite-side sources reviewed;
   - routing decision and specialist skills called or intentionally skipped;
   - Supplier Quote Normalization Result when called;
   - Technical Compliance Impact when called;
   - Certificate / Origin / Document Impact when called;
   - Numerical Proof Appendix when any material numbers are involved;
   - evidence needed, blockers, and next required action;
   - recommendation: continue, block, ask supplier, ask customer, rerun pricing, revisit selected offer, regenerate forms, or rerun QA.
    Return chat evidence for interim normalization/compliance. For a customer-required standalone Response Impact artifact, return only its verified Windows path and browser-safe preview link.
11. If the reply has no technical, commercial, certificate, document, schedule, selected-offer, form, or QA effect, summarize it as `NO BID IMPACT` with source evidence and continue the current stage. A short chat-visible impact note is enough for no-impact replies unless the user asks for an HTML report.

Do not advance to selected-offer freeze, forms, QA, or submission after a meaningful new reply until the impacted specialist review is complete and unresolved conflicts are recorded as blockers.

## RFQ Analysis Review Gate

Use this gate immediately after successful `rfq-analysis` and before any supplier search or sourcing action.

1. Require `rfq-analysis` to persist the structured `rfq_analysis`, `rfq_items`, and `customers` records where the live tables/columns exist.
2. Require a readable RFQ Analysis Report artifact or chat-visible report that includes deadline, RFQ requirement summary, special/further requirements, extracted items, and clarifications.
3. Show the report to the user and state that supplier search is paused for validation.
4. Persist or request persistence through `quoteflow-neon`:
   - `current_stage = rfq_analysis_review`
   - `stage_status = pending_user_validation` when available, otherwise `needs_review`
   - `next_required_action = user must review RFQ Analysis Report and approve/proceed to supplier search`
   - `stage_blockers = user_validation_pending`
   - `completed_stages` includes `rfq_analysis`
5. Treat user approval phrases such as `approved`, `approve`, `validated`, `proceed`, `proceed to supplier search`, `continue to supplier search`, or equivalent clear approval as authorization to advance. On approval, update or request persistence of `current_stage = supplier_search`, `stage_status = ready_for_next_stage` or `in_progress`, clear the user-validation blocker, and then call `suppliers-search` when the user's request asks to continue.
6. If the user requests corrections, missing item fixes, customer-data changes, or report edits, route back to `rfq-analysis` or the narrowest intake owner, then repeat this gate.
7. Explicit `skip`, `auto-run`, `bypass validation`, or `test mode` instructions may bypass the gate only when the user clearly asks for that behavior for testing or automation. Record the bypass reason in `next_required_action` or `stage_blockers` history when the schema supports it. The default is always to pause for user validation.

Do not infer approval from silence, a generic status check, or a request to "analyze" the RFQ.

## Branding Asset Intake

Use this when the user uploads or provides two company branding pictures for proposal generation.

1. Inspect both images before storing them when file paths are available.
2. Classify the company logo as the image that looks like a corporate mark, wordmark, emblem, letterhead logo, or regular graphic with stronger rectangular/brand layout.
3. Classify the authorized signature as the image that looks like handwriting, initials, stamp-signature, pen stroke, or signatory mark.
4. If exactly one logo and one signature can be identified, copy them into:
   - logo: `C:\Users\LENOVO\.codex\skills\report-generator\assets\logos\logo.[ext]`
   - signature: `C:\Users\LENOVO\.codex\skills\report-generator\assets\signatures\signature.[ext]`
5. Preserve the original extension when it is `.png`, `.jpg`, `.jpeg`, `.svg`, or `.gif`. If a canonical file with the same extension already exists, archive the old file with a timestamp suffix before replacing it.
6. If both images look like logos, both look like signatures, or either image is unclear, ask the user to confirm which file is logo and which file is signature before storing.
7. After storing assets, route proposal generation to `report-generator`; do not pass logo/signature paths unless using a one-off override, because the retained `proposal-html-generator.ps1` automatically reads the canonical asset folders. Do not retire it until the web-app print/export path has verified equivalent editable HTML, branding, and print behavior.

Do not store unrelated product images, datasheets, customer documents, or supplier screenshots in the branding asset folders.

## Web App Final-Report Gate

For normal workflow review, use canonical QuoteFlow deep links:

- Quotes: `http://localhost:3000/?view=documents&tab=quotes&rfqId=<id>`.
- Technical: `http://localhost:3000/?view=documents&tab=technical&rfqId=<id>`.
- Pricing: `http://localhost:3000/?view=pricing&rfqId=<id>`.
- Proposal: `http://localhost:3000/?view=proposal&rfqId=<id>`.

For interim normalization and technical compliance, return chat evidence only and no final link. Do not generate or open standalone HTML during normal workflow. Retain standalone artifacts only where a customer explicitly requires them, including a Response Impact Report or editable technical/commercial proposal.

## Workflow

1. Resolve the RFQ/tender identity from user input, Gmail subject, Drive folder, local files, reply/watch event, or `rfq_analysis` identifiers.
2. Run the Setup Preflight Gate at the first invocation or when the user requests setup. If it fails, pause before signup and all normal workflow work. Then run the Signup Bootstrap Gate. If signup is incomplete, pause normal workflow until the web app writes `SIGNUP.json` with returned Neon IDs.
3. Use `quoteflow-neon` to inspect the live `rfq_analysis` schema and fetch the matching row's stage fields.
4. Activate `rfq-workflow-learner` quietly for observation when the task involves a multi-stage RFQ/bid workflow, a customer/supplier email, a stage transition, or a repeated user correction pattern.
5. Run the Model Switch Gate so ordinary orchestration stays on a light route and only risky specialist stages are escalated.
6. If email/inbox/watch checking discovers unrelated new original RFQs while this task is handling a current RFQ, run the Separate RFQ Task Gate before doing any analysis for those new RFQs.
7. If no matching row exists, or `current_stage` is empty/new and the request is analysis/package intake, start with `rfq-analysis` for Gmail sources or `tender-document-intake` for file/package sources.
8. Confirm tender scope, RFQ/RFP/ITT identifiers, customer, deadline, bid validity, submission platform, and technical/commercial separation rules.
9. Initialize or open the RFQ cleanup manifest as soon as the RFQ reference or `rfq_id` is known.
10. Identify available inputs: Gmail thread, Drive folder, local tender files, supplier offers, customer/supplier reply history, pricing data, company details, branding logo/signature images, signatures, seals, and required customer forms.
11. If the user uploads or provides two branding pictures for proposal generation, run Branding Asset Intake before proposal generation.
12. If the request or active watch includes a new customer/supplier/OEM/manufacturer/distributor reply, persist the source event first, then run the Customer/Supplier Reply Impact Gate before ordinary stage routing.
13. Route by verified database stage and artifacts:
   - `report_analysis`, `rfq_analysis`, `intake`, empty, or new: call `rfq-analysis` for Gmail RFQs or `tender-document-intake` for file/tender packages.
   - `rfq_analysis_review`, or any row with `stage_status = pending_user_validation`: run the RFQ Analysis Review Gate; call `suppliers-search` only after explicit approval or explicit test-mode skip/auto-run bypass.
   - `tender_document_intake`: call `tender-document-intake`.
   - `supplier_search` or `ready_for_sourcing`: call `suppliers-search`.
   - `supplier_quote_normalization` or `ready_for_quote_normalization`: call `supplier-quotation-normalizer`.
   - `technical_compliance_review` or `ready_for_compliance`: call `technical-compliance-review`.
   - `certificate_origin_review`: call `certificate-origin-review`.
   - `commercial_pricing`: call `comercial-pricing`; do not advance to `selected_offer` until it reports a user-approved pricing canvas/review packet or explicit user-approved direct pricing, validated calculations, and persisted pricing rows.
   - `selected_offer` or `ready_for_selection`: call `selected-offer-manager`.
   - `bid_forms_generation` or `ready_for_forms`: call `bid-forms-generator`.
   - `submission_qa`, `ready_for_qa`, or `packaging`: call `submission-qa-packager`.
14. If database stage and user request conflict, explain the conflict and choose the safer earlier stage unless the user explicitly instructs a later-stage action with sufficient source data.
15. After successful `rfq-analysis`, do not continue directly to supplier search. Require the RFQ Analysis Review Gate, show the readable report, and persist `current_stage = rfq_analysis_review` with `stage_status = pending_user_validation` or `needs_review` before ending or waiting for approval.
16. After each successful stage or generated local artifact, append the artifact path to the RFQ cleanup manifest with an appropriate retention value.
17. After each other successful stage or reply-impact review, require the stage owner to persist its structured result table first, then use `quoteflow-neon` to persist the new `current_stage`, `stage_status`, `next_required_action`, `stage_blockers`, and `completed_stages` when the target RFQ row is clear.
18. Let `rfq-workflow-learner` capture the stage outcome, user corrections, evidence pattern, blocker, reply-impact result, or next action in background mode when persistence is available or as chat-local observation when it is not.
19. For any customer/supplier email, supplier RFQ email, clarification request, follow-up, or final cover email, call `procurement-email-composer` for wording and accuracy first. Use `gmail:gmail` only for Gmail search/read/draft/send operations after the draft has been shown in chat and explicitly approved.
20. After an approved Gmail send or reply is completed for an RFQ workflow, immediately call `scheduled-task` to create or update an active hourly `rfq_watch` unless the user explicitly says not to monitor. Register the sent/replied Gmail thread as a watch target, checkpoint the latest known message, and request notification through ChatGPT/mobile/email according to the user's ChatGPT notification settings. Include in the watch instruction that meaningful new replies must return to this orchestrator's Customer/Supplier Reply Impact Gate before advancing the bid. Do not promise direct SMS or phone-number notification unless a separate notification integration exists.
21. Proactively identify other schedule-worthy tasks such as bid deadlines, supplier quote validity expiry, customer clarification due dates, supplier follow-up dates, OEM/document/certificate response watches, pricing approvals, selected-offer approvals, QA deadlines, or final submission reminders.
22. For any proactive schedule-worthy task outside the mandatory post-email watch, ask the user for approval before calling `scheduled-task`. The approval request must be 20-30 words maximum and include the task description, purpose, and reason it should be created.
23. After final successful customer submission, final quotation send, or explicit user statement that the RFQ project is finished, run the Final Cleanup Gate for local artifacts and the Final Watch Cleanup Gate for finished RFQ monitoring rows before considering cleanup complete.
24. At natural pause points such as after an email send, stage completion, blocker report, reply-impact review, or final session summary, allow `rfq-workflow-learner` to propose a short approval-gated skill update or creation idea only when it has a concrete repeated pattern.
25. End only when final delivery outputs exist or the blocker is explicitly stated.

## Parallel Dispatch

Use `dispatch-parralel-agents` only when workstreams are independent and safe to split, such as:

- reviewing different tender attachments;
- normalizing different supplier quotations;
- checking different product groups;
- running separate QA passes on technical, commercial, and form consistency.

Keep final decisions, database writes, email sends, selected-offer freeze, and final package readiness in the main workflow.

Before dispatching workers or calling `chatllm-call`, use `model-routing-policy` to choose the lightest safe route, complexity tier, and privacy classification. Keep selected-offer decisions, pricing exposure, final compliance judgments, final database writes, and final bid-package QA in the main Codex workflow even when model assistance is used.

## Existing Skills To Use

- `quoteflow-neon`: Required for all QuoteFlow Neon fetching, inspection, persistence, schema checks, company/user context, selected offers, pricing, workflow stage fields, blockers, completed stages, and package status.
- `model-routing-policy`: Use before worker dispatch or external model calls to choose local, worker, or `chatllm-call` routing by complexity and privacy.
- `rfq-workflow-learner`: Use in quiet background observation mode for multi-stage RFQ workflows, stage handoffs, repeated user corrections, customer/supplier email approvals, blockers, and end-of-session improvement proposals. It may propose skill or workflow updates only at natural pause points and only with user approval.
- `procurement-email-composer`: Use for all customer/supplier procurement email wording, supplier RFQs, clarification requests, follow-ups, technical/OEM questions, and final cover emails. It must show drafts in chat before Gmail draft/send actions.
- `gmail:gmail`: Use for live tender emails, supplier quote threads, and customer/supplier clarification history, and for Gmail draft/send actions only after user-approved content from `procurement-email-composer`.
- Codex task/thread tools: Use `list_projects` and `create_thread` when available to create a same-project separate task for every unrelated new original RFQ discovered while this task is already handling another RFQ.
- `google-drive`: Use for project files in Drive.
- `pdf`, `documents`, `spreadsheets`: Use according to tender, supplier quote, form, and attachment file formats.
- `chatllm-call`: Use only for approved model-assisted extraction, comparison, classification, or wording where privacy permits.
- `scheduled-task`: Use for bid deadlines, supplier follow-ups, clarification reminders, response watches, approval reminders, and mandatory post-email RFQ watch registration after approved customer/supplier Gmail sends or replies in an RFQ workflow. Post-email RFQ watches are automatic unless the user says not to monitor; all other proactive schedules require explicit user approval first.
- `report-generator`: Use for structured reports, RFQ Analysis Report HTML review artifacts, supplier-search HTML reports, combined Response Impact Report HTML after meaningful customer/supplier replies, and native editable technical/commercial supplier proposal HTML generation. For proposal paths, it must use `proposal-html-generator.ps1` and must not use spreadsheet, document, or PDF plugins. Technical proposal outputs must remove all price columns and totals; commercial proposal outputs must include approved pricing. Branding assets should come from `report-generator\assets\logos` and `report-generator\assets\signatures`.

## Outputs

- Current readiness gate and blocker list.
- Separate-task creation status for unrelated new original RFQs discovered during inbox/watch checks.
- Active cleanup manifest path, artifact count, and cleanup receipt path when cleanup runs.
- Final watch-cleanup status for `scheduled_tasks` and `rfq_watch_targets`, including deleted/skipped/error counts when cleanup runs.
- RFQ Analysis Report reference or chat-visible report, plus validation status, when the workflow has just completed RFQ analysis or is parked at `rfq_analysis_review`.
- Combined HTML Response Impact Report for meaningful customer/supplier/OEM/manufacturer/distributor replies, including source, prior checkpoint, opposite-side sources reviewed, routing decision, skills called/skipped, specialist findings, numerical proof when applicable, blockers, recommendation, and next action.
- Tender/RFQ source references and required downstream stages.
- Frozen selected-offer dataset reference.
- Generated bid form set reference.
- Native editable technical/commercial proposal HTML references from `report-generator` when supplier proposal documents are required; PDFs are created manually by the user from the HTML print dialog when needed.
- Technical document index reference.
- `Technical Proposal/` folder and ZIP.
- `Commercial Proposal/` folder and ZIP.
- Complete submission package ZIP.
- Final Bid QA Report.
- Short customer cover email.

## Failure Rules

- Do not declare the workflow complete after analysis, sourcing, pricing, or reports alone.
- Do not call `suppliers-search` immediately after `rfq-analysis` by default. Supplier search requires RFQ Analysis Review Gate approval, or an explicit test-mode skip/auto-run bypass.
- Do not treat `stage_status = needs_review` or `pending_user_validation` after RFQ analysis as ready for sourcing.
- Do not bypass selected-offer freeze before generating final forms.
- Do not advance from `commercial_pricing` to `selected_offer`, forms, QA, or submission when final customer pricing is required unless `comercial-pricing` reports user-approved pricing variables and persisted official pricing.
- Do not generate customer-facing documents from draft supplier quotes, assumptions, or conflicting data.
- Do not proceed past a readiness gate with unresolved `CRITICAL` issues.
- Do not process unrelated new original RFQs inside the current RFQ task. Create or request a separate same-project task with `$bid-package-orchestrator` activated.
- Do not delete or archive local RFQ artifacts without loading the cleanup manifest and passing the Final Cleanup Gate.
- Do not delete Neon database rows as part of local artifact cleanup. The only normal final-stage exception is the approved Final Watch Cleanup Gate, which is limited to finished-RFQ rows in `scheduled_tasks` and `rfq_watch_targets`.
- Do not treat a new customer or supplier reply as informational only until the reply-impact gate has checked whether it changes requirements, offers, certificates/origin, pricing, selected offers, forms, QA, or submission instructions.
- Do not run supplier quote normalization, technical compliance review, and certificate/origin review as a blind fixed bundle after a reply. Run only affected skills, in dependency order, and stop on blockers.
- Do not advance after a meaningful reply without a combined Response Impact Report unless the reply is explicitly classified as `NO BID IMPACT` or the user explicitly asks for a chat-only summary.
- Do not advance after a meaningful new reply until impacted specialist reviews are complete or blockers are recorded.
- Do not mark a stage complete when its structured result could not be persisted to the correct QuoteFlow table or a blocker was not recorded.
- Do not hide confirmed technical deviations or contractual exceptions.
- Do not expose supplier purchase costs, internal margins, internal procurement analysis, or supplier quotations in customer-facing folders.
- Do not replace customer-prescribed forms or legal wording unless the user explicitly instructs it.
