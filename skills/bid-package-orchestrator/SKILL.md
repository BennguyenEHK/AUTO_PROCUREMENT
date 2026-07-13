---
name: bid-package-orchestrator
description: Orchestrate the end-to-end industrial tender workflow from RFQ/RFP/ITT intake through selected offer, bid forms, technical documents, QA, final Technical Proposal and Commercial Proposal folders, ZIP files, QA report, and customer cover email. Use when Codex needs to coordinate multiple QuoteFlow procurement skills to produce a complete bid-ready submission package rather than only analysis, sourcing, pricing, or reports; when customer or supplier replies require a reply-impact review against prior requirements, offers, clarifications, selected offers, pricing, documents, or QA state; also use model-routing-policy when choosing worker/model complexity for delegated procurement tasks.
---

# Bid Package Orchestrator
## Local Artifact Links

When returning local artifacts, resolve the actual absolute Windows path; use Windows links (and browser-safe `file:///C:/...` for HTML), never `/mnt/c/...` or `C:/mnt/c/...`.

## Purpose

Coordinate the complete tender-to-submission workflow. This skill owns sequencing, readiness gates, dependency routing, reply-impact gates, and final completion criteria.

This skill owns the control question: "A customer or supplier replied; what changed, which historical sources must be loaded, which specialist review must run, and can the bid safely continue?" It does not replace the specialist technical, certificate, commercial, or QA judgment skills.

Use this skill when the user asks for a full bid package, formal tender submission, technical/commercial proposal folders, final package ZIPs, or a workflow that must continue beyond RFQ analysis.

The workflow is complete only when the required final outputs exist or a blocker is explicitly reported.

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
4. After analysis/intake succeeds, update or request persistence of `current_stage`, `stage_status`, `next_required_action`, `stage_blockers`, and `completed_stages` through `quoteflow-neon`.

Treat `current_stage` as the workflow pointer, not proof of completion. Before advancing, verify the current stage's required artifacts and status. If `stage_status` is `blocked` or `needs_review`, resolve or report `stage_blockers` before calling downstream skills. If `next_required_action` is present and consistent with the user's request, prioritize it.

## Stage Routing Map

Use this map immediately after reading `rfq_analysis.current_stage` through `quoteflow-neon`:

| `current_stage` value | Primary skill to call | Expected next stage |
| --- | --- | --- |
| empty, null, `new`, `report_analysis`, `rfq_analysis`, `intake` | `rfq-analysis` for Gmail RFQs, or `tender-document-intake` for file/tender packages | `supplier_search` or `tender_document_intake` |
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
- `READY FOR SOURCING`: customer requirements and technical groups are structured enough for supplier search/RFQ.
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

1. Resolve the RFQ identity, party type, message/thread/file source, response date, and latest checkpoint.
2. Persist the source reply/event through `quoteflow-neon` before review. For email, upsert `incoming_emails` and link `rfq_id`; add `rfq_email_events` when available.
3. Load the relevant prior history through the owning tools and skills:
   - customer requirement baseline, tender addenda, customer clarifications, and submission instructions;
   - normalized supplier offers, revised quotations, supplier clarifications, assumptions, exclusions, and quote validity;
   - previous technical compliance matrices, deviation registers, certificate/origin matrices, selected-offer records, pricing state, generated forms, and QA blockers when they exist.
4. Decide whether the reply is meaningful for the bid. Meaningful changes include new or changed specifications, quantities, technical clarifications, accepted or rejected alternatives, certificates, origin, documentation, lead time, warranty, validity, Incoterm, price, exclusions, commercial terms, approvals, rejections, or submission instructions.
5. For a customer reply with new or changed requirements, update or refine the customer baseline through `tender-document-intake` or `rfq-analysis` when needed, then route to `technical-compliance-review` to compare current supplier offers or selected offers against the latest customer baseline. Also route to `certificate-origin-review`, `supplier-quotation-normalizer`, `comercial-pricing`, `selected-offer-manager`, `bid-forms-generator`, or `submission-qa-packager` when the changed requirement affects those areas.
6. For a supplier reply with a revised offer, technical clarification, quote revision, certificate/origin response, or commercial change, route first to the narrowest extraction owner such as `supplier-quotation-normalizer` or `certificate-origin-review`, then route to `technical-compliance-review` to compare the supplier response against the latest customer baseline when technical fit is affected.
7. For numerical reply content, require the owning specialist skill to provide the calculation method and graph/table proof when the number affects compliance, pricing, quantity, validity, lead time, or QA. The orchestrator records that the numerical proof was requested and blocks advancement if a material proof is missing.
8. Produce or request a Response Impact Review containing:
   - new response source and prior checkpoint;
   - affected customer items, fields, stages, and documents;
   - opposite-side sources reviewed;
   - routing decision and specialist skill called;
   - evidence needed, blockers, and next required action.
9. If the reply has no technical, commercial, certificate, document, schedule, selected-offer, form, or QA effect, summarize it as `NO BID IMPACT` with source evidence and continue the current stage.

Do not advance to selected-offer freeze, forms, QA, or submission after a meaningful new reply until the impacted specialist review is complete and unresolved conflicts are recorded as blockers.

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
7. After storing assets, route proposal generation to `report-generator`; do not pass logo/signature paths unless using a one-off override, because `proposal-html-generator.ps1` automatically reads the canonical asset folders.

Do not store unrelated product images, datasheets, customer documents, or supplier screenshots in the branding asset folders.

## Workflow

1. Resolve the RFQ/tender identity from user input, Gmail subject, Drive folder, local files, reply/watch event, or `rfq_analysis` identifiers.
2. Use `quoteflow-neon` to inspect the live `rfq_analysis` schema and fetch the matching row's stage fields.
3. Activate `rfq-workflow-learner` quietly for observation when the task involves a multi-stage RFQ/bid workflow, a customer/supplier email, a stage transition, or a repeated user correction pattern.
4. If no matching row exists, or `current_stage` is empty/new and the request is analysis/package intake, start with `rfq-analysis` for Gmail sources or `tender-document-intake` for file/package sources.
5. Confirm tender scope, RFQ/RFP/ITT identifiers, customer, deadline, bid validity, submission platform, and technical/commercial separation rules.
6. Identify available inputs: Gmail thread, Drive folder, local tender files, supplier offers, customer/supplier reply history, pricing data, company details, branding logo/signature images, signatures, seals, and required customer forms.
7. If the user uploads or provides two branding pictures for proposal generation, run Branding Asset Intake before proposal generation.
8. If the request or active watch includes a new customer/supplier/OEM/manufacturer/distributor reply, persist the source event first, then run the Customer/Supplier Reply Impact Gate before ordinary stage routing.
8. Route by verified database stage and artifacts:
   - `report_analysis`, `rfq_analysis`, `intake`, empty, or new: call `rfq-analysis` for Gmail RFQs or `tender-document-intake` for file/tender packages.
   - `tender_document_intake`: call `tender-document-intake`.
   - `supplier_search` or `ready_for_sourcing`: call `suppliers-search`.
   - `supplier_quote_normalization` or `ready_for_quote_normalization`: call `supplier-quotation-normalizer`.
   - `technical_compliance_review` or `ready_for_compliance`: call `technical-compliance-review`.
   - `certificate_origin_review`: call `certificate-origin-review`.
   - `commercial_pricing`: call `comercial-pricing`; do not advance to `selected_offer` until it reports a user-approved pricing canvas/review packet or explicit user-approved direct pricing, validated calculations, and persisted pricing rows.
   - `selected_offer` or `ready_for_selection`: call `selected-offer-manager`.
   - `bid_forms_generation` or `ready_for_forms`: call `bid-forms-generator`.
   - `submission_qa`, `ready_for_qa`, or `packaging`: call `submission-qa-packager`.
9. If database stage and user request conflict, explain the conflict and choose the safer earlier stage unless the user explicitly instructs a later-stage action with sufficient source data.
10. After each successful stage or reply-impact review, require the stage owner to persist its structured result table first, then use `quoteflow-neon` to persist the new `current_stage`, `stage_status`, `next_required_action`, `stage_blockers`, and `completed_stages` when the target RFQ row is clear.
11. Let `rfq-workflow-learner` capture the stage outcome, user corrections, evidence pattern, blocker, reply-impact result, or next action in background mode when persistence is available or as chat-local observation when it is not.
12. For any customer/supplier email, supplier RFQ email, clarification request, follow-up, or final cover email, call `procurement-email-composer` for wording and accuracy first. Use `gmail:gmail` only for Gmail search/read/draft/send operations after the draft has been shown in chat and explicitly approved.
13. After an approved Gmail send or reply is completed for an RFQ workflow, immediately call `scheduled-task` to create or update an active hourly `rfq_watch` unless the user explicitly says not to monitor. Register the sent/replied Gmail thread as a watch target, checkpoint the latest known message, and request notification through ChatGPT/mobile/email according to the user's ChatGPT notification settings. Include in the watch instruction that meaningful new replies must return to this orchestrator's Customer/Supplier Reply Impact Gate before advancing the bid. Do not promise direct SMS or phone-number notification unless a separate notification integration exists.
14. Proactively identify other schedule-worthy tasks such as bid deadlines, supplier quote validity expiry, customer clarification due dates, supplier follow-up dates, OEM/document/certificate response watches, pricing approvals, selected-offer approvals, QA deadlines, or final submission reminders.
15. For any proactive schedule-worthy task outside the mandatory post-email watch, ask the user for approval before calling `scheduled-task`. The approval request must be 20-30 words maximum and include the task description, purpose, and reason it should be created.
16. At natural pause points such as after an email send, stage completion, blocker report, reply-impact review, or final session summary, allow `rfq-workflow-learner` to propose a short approval-gated skill update or creation idea only when it has a concrete repeated pattern.
17. End only when final delivery outputs exist or the blocker is explicitly stated.

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
- `google-drive`: Use for project files in Drive.
- `pdf`, `documents`, `spreadsheets`: Use according to tender, supplier quote, form, and attachment file formats.
- `chatllm-call`: Use only for approved model-assisted extraction, comparison, classification, or wording where privacy permits.
- `scheduled-task`: Use for bid deadlines, supplier follow-ups, clarification reminders, response watches, approval reminders, and mandatory post-email RFQ watch registration after approved customer/supplier Gmail sends or replies in an RFQ workflow. Post-email RFQ watches are automatic unless the user says not to monitor; all other proactive schedules require explicit user approval first.
- `report-generator`: Use for structured reports and native editable technical/commercial supplier proposal HTML generation. For this proposal path, it must use `proposal-html-generator.ps1` and must not use spreadsheet, document, or PDF plugins. Technical proposal outputs must remove all price columns and totals; commercial proposal outputs must include approved pricing. Branding assets should come from `report-generator\assets\logos` and `report-generator\assets\signatures`.

## Outputs

- Current readiness gate and blocker list.
- Response Impact Review for meaningful customer/supplier/OEM/manufacturer/distributor replies, including source, prior checkpoint, opposite-side sources reviewed, routing decision, blockers, and next action.
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
- Do not bypass selected-offer freeze before generating final forms.
- Do not advance from `commercial_pricing` to `selected_offer`, forms, QA, or submission when final customer pricing is required unless `comercial-pricing` reports user-approved pricing variables and persisted official pricing.
- Do not generate customer-facing documents from draft supplier quotes, assumptions, or conflicting data.
- Do not proceed past a readiness gate with unresolved `CRITICAL` issues.
- Do not treat a new customer or supplier reply as informational only until the reply-impact gate has checked whether it changes requirements, offers, certificates/origin, pricing, selected offers, forms, QA, or submission instructions.
- Do not advance after a meaningful new reply until impacted specialist reviews are complete or blockers are recorded.
- Do not mark a stage complete when its structured result could not be persisted to the correct QuoteFlow table or a blocker was not recorded.
- Do not hide confirmed technical deviations or contractual exceptions.
- Do not expose supplier purchase costs, internal margins, internal procurement analysis, or supplier quotations in customer-facing folders.
- Do not replace customer-prescribed forms or legal wording unless the user explicitly instructs it.
