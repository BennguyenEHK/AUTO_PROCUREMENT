---
name: tender-document-intake
description: Intake, index, and structure customer tender, RFQ, RFP, ITT, addenda, drawings, forms, datasheets, commercial terms, and submission instructions. Use when Codex needs a Tender Document Register, customer requirement baseline, item extraction, technical grouping, gap/ambiguity register, required forms/certificates/native files/signed PDFs, or technical/commercial package separation rules before sourcing, quotation normalization, compliance review, pricing, or bid package generation.
---

# Tender Document Intake
## Local Artifact Links

When returning local artifacts, resolve the actual absolute Windows path; use Windows links (and browser-safe `file:///C:/...` for HTML), never `/mnt/c/...` or `C:/mnt/c/...`.

## Purpose

Convert tender inputs into a traceable requirement baseline and handoff packet. This skill is the front-end tender control layer for full bid packages.

Intake is not completion. Downstream work must continue until the required technical and commercial submission outputs are produced or a blocker is identified.

## Workflow Stage

- Stage: `tender_document_intake`
- Previous stage: `rfq_analysis`, `new`, or no persisted RFQ stage.
- Next stage: `supplier_search`, or `technical_compliance_review` if supplier offers already exist and intake is only defining tender requirements.
- Stage owner: `bid-package-orchestrator`.
- State persistence: after creating the tender register, requirement baseline, item groups, and gap register, use `quoteflow-neon` to update stage fields when the target RFQ row is clear. On success, append this stage to `completed_stages`, set `current_stage` to the orchestrator-selected next stage, set `stage_status` to `ready_for_next_stage` or `in_progress`, clear/refresh `stage_blockers`, and write `next_required_action`. On block, do not advance `current_stage`; set `stage_status = blocked`, populate `stage_blockers`, and set `next_required_action` to the unblock action.
- Boundary: this skill controls tender document intake and requirement baselining. It should not normalize supplier quotes, select final offers, generate final forms, or package the submission.
## Workflow

1. Identify all tender inputs: emails, PDFs, Word files, Excel schedules, drawings, datasheets, forms, addenda, commercial terms, submission instructions, and platform notes.
2. Create a Tender Document Register with filename, document type, revision/date, source, page/sheet references, purpose, and whether it affects technical, commercial, legal, or submission requirements.
3. Extract tender identity: customer, end user, RFQ/RFP/ITT number, package description, bid closing date/time, bid validity, submission platform, and submission method.
4. Separate requirements into administrative, technical, commercial, required forms, required certificates, supporting documents, native editable files, signed PDFs, and technical/commercial package separation rules.
5. Preserve customer-prescribed forms, table structures, legal declarations, and wording.
6. Extract customer items into structured fields when available:
   - item ID, package description, tag, equipment type, manufacturer/brand, original model, original P/N, customer description, application, range, unit, accuracy, process connection, flange/rating/face, materials, dimensions, pressure, IP/hazardous-area requirement, standards, certificates, documentation, country of origin, quantity, UOM, delivery, and warranty.
7. Group technically similar items by equipment type, manufacturer, product family, measurement principle, process interface, material, application, and certification.
8. Identify missing, ambiguous, contradictory, or high-risk information.
9. Classify each gap as `CRITICAL FOR QUOTATION`, `CRITICAL FOR TECHNICAL ACCEPTANCE`, `COMMERCIAL CLARIFICATION`, or `CAN BE CONFIRMED AFTER AWARD`.
10. Produce a downstream handoff packet with source references.

## Skill Routing

- Use `gmail` when tender source is an email thread or attachments need retrieval.
- Use `google-drive` when tender files are in Drive.
- Use `pdf`, `documents`, or `spreadsheets` according to file type.
- Use `rfq-analysis` when the user asks from a Gmail subject or when project RFQ item extraction/persistence is needed.
- Use `quoteflow-neon` only when inspecting, creating, updating, or reconciling QuoteFlow records.
- Use `model-routing-policy` before `chatllm-call` when extraction, classification, or ambiguity review needs model assistance; keep confidential tender content local unless approved.
- Use `suppliers-search` after technical grouping when supplier discovery is requested.
- Hand off to `supplier-quotation-normalizer`, `technical-compliance-review`, `certificate-origin-review`, `comercial-pricing`, and `bid-package-orchestrator` as the workflow advances.

## Outputs

- Tender Document Register.
- Tender metadata summary.
- Customer requirement baseline.
- Structured item table.
- Technical item groups.
- Gap and ambiguity register.
- Clarification question list.
- Downstream handoff packet with source references.

## Failure Rules

- Do not rewrite customer legal declarations or prescribed forms unless explicitly instructed.
- Do not infer missing technical attributes as confirmed requirements.
- Do not silently normalize model, material, rating, certificate, origin, or quantity differences.
- If document access is incomplete, mark affected outputs as partial and list missing files.
- If sources conflict, preserve both values with source references and flag the conflict.
- Do not claim tender workflow completion after intake.

