---
name: technical-compliance-review
description: Compare customer technical requirements against supplier or selected offered products, classify differences, evaluate fit/form/function/application suitability, identify technical deviations, prepare compliance matrices, and draft technical exception reasoning for industrial tender submissions. Use when Codex needs requirement-vs-offer review, customer/supplier reply-impact technical review, evidence-backed response comparison, numerical compliance calculations, graph/table proof, deviation status, OEM clarification questions, Form 2 exception inputs, or technical risk findings before selected-offer approval or final bid forms.
---

# Technical Compliance Review
## Local Artifact Links

When returning local artifacts, resolve the actual absolute Windows path; use Windows links (and browser-safe `file:///C:/...` for HTML), never `/mnt/c/...` or `C:/mnt/c/...`.

## Purpose

Act as technical bid reviewer. Compare requirement vs offer field by field, classify differences accurately, and protect end-user safety and bidder position.

This skill owns the technical judgment question: "Does the customer requirement and supplier response actually match, with defensible evidence, calculations, visual proof for numerical comparisons, and risk classification?" It does not own email watching, workflow stage routing, selected-offer freeze, or final package release.

Never hide confirmed deviations. Do not overstate coding differences, legacy/current model changes, regional configurations, or documentation gaps as functional non-compliance without evidence.

## Workflow Stage

- Stage: `technical_compliance_review`
- Previous stage: `supplier_quote_normalization`.
- Next stage: `certificate_origin_review` when document/origin evidence is still required, otherwise `commercial_pricing`.
- Stage owner: `bid-package-orchestrator`.
- State persistence: after the compliance matrix, deviation register, risk summary, OEM/customer clarification needs, and `technical_compliance_reviews` persistence are complete, use `quoteflow-neon` to update stage fields when the target RFQ row is clear. On success, append this stage to `completed_stages`, set `current_stage` to the orchestrator-selected next stage, set `stage_status` to `ready_for_next_stage` or `in_progress`, clear/refresh `stage_blockers`, and write `next_required_action`. On block, do not advance `current_stage`; set `stage_status = blocked`, populate `stage_blockers`, and set `next_required_action` to the unblock action.
- Boundary: this skill decides technical comparison outputs only. It should not watch email threads, calculate commercial prices, freeze selected offers, or package the final submission.
## Response Impact Technical Review

Use this mode when `bid-package-orchestrator` routes a new customer/supplier/OEM/manufacturer/distributor response for technical review.

1. Load the new response and identify whether it changes a customer requirement, supplier offer, technical clarification, deviation, alternative, datasheet, drawing, certificate-related technical requirement, or selected-offer assumption.
2. Load the opposite-side baseline:
   - for customer replies, load current supplier offers, selected offers, previous supplier technical clarifications, and prior compliance matrices;
   - for supplier replies, load the latest customer requirement baseline, tender addenda, customer clarifications, and required forms/specifications.
3. Compare the changed response against the latest opposite-side baseline and previous compliance conclusion. Mark whether the previous conclusion remains valid, must be revised, or is blocked pending clarification.
4. Produce a clear `YES`, `NO`, or `BLOCKED/INSUFFICIENT EVIDENCE` technical answer for each affected item and field. Do not give a yes/no answer without source evidence.
5. Preserve both sides when sources conflict, rank source authority, and state what must be clarified before bid continuation.

## Evidence, Calculations, And Graph Proof

Every material conclusion must include an evidence packet:

- customer source: document/email/thread/file, revision/date, page/sheet/message context when available, item/field, and quoted or tightly paraphrased requirement;
- supplier source: quotation/email/thread/file, revision/date, line/item reference, offered value, and quoted or tightly paraphrased supplier statement;
- comparison result: matched field, normalized value, status, risk, and reviewer note.

For numerical technical comparisons, include the calculation method and a visual proof:

1. Normalize units and state any conversion factor used.
2. Identify the comparator: exact match, minimum, maximum, required range, tolerance, rating, quantity, or coverage.
3. Show the formula, substituted values, pass/fail result, and margin.
4. Include a table plus graph proof for each material numerical conclusion. Use a rendered chart in a spreadsheet, report, or HTML when available; otherwise use a text-safe range bar or comparison chart. The visual must support the calculation, not decorate it.

Common calculation patterns:

- minimum rating: `margin = offered_value - required_minimum`;
- maximum limit: `margin = required_maximum - offered_value`;
- percent deviation: `((offered_value - required_value) / required_value) * 100`;
- range overlap: `overlap = max(0, min(offered_max, required_max) - max(offered_min, required_min))`;
- range coverage: `(overlap / (required_max - required_min)) * 100`.

If a number cannot be normalized or the source is unreadable, mark the result `BLOCKED/INSUFFICIENT EVIDENCE` and request clarification rather than guessing.

## Workflow

1. Load customer requirement baseline from `tender-document-intake`, `rfq-analysis`, or source tender files.
2. Load normalized supplier offer data or the selected-offer dataset.
3. Compare each item field by field:
   - manufacturer, model, P/N, range, unit, accuracy, dial, process connection, mounting, flange, stem, capillary, wetted material, housing, diaphragm, static pressure, overload, IP, temperature, standard, certificates, and documentation.
4. Assign a status per material difference:
   - `COMPLY`
   - `COMPLY - ADDITIONAL FEATURE`
   - `COMPLY - HIGHER RATING`
   - `CODING DIFFERENCE`
   - `LEGACY/CURRENT MODEL DIFFERENCE`
   - `REGIONAL CONFIGURATION DIFFERENCE`
   - `DOCUMENTATION GAP`
   - `CLARIFICATION REQUIRED`
   - `TECHNICAL ALTERNATIVE`
   - `PHYSICAL CONFIGURATION DIFFERENCE`
   - `FUNCTIONAL DEVIATION`
   - `NON-COMPLY`
5. For every deviation or alternative, evaluate:
   - `FIT`: physical installation and connection compatibility.
   - `FORM`: geometry, arrangement, mounting, orientation, or envelope differences.
   - `FUNCTION`: measurement or equipment function suitability.
   - `APPLICATION SUITABILITY`: process duty, pressure, temperature, corrosion, offshore, marine, hazardous-area, or industrial conditions.
6. Assign risk as `LOW RISK`, `MEDIUM RISK`, `HIGH RISK`, or `CRITICAL RISK`.
7. Identify duty-critical features retained, actual differences, technical significance, required OEM confirmations, customer-facing exception wording, and whether prior compliance conclusions remain valid after any new response.
8. Separate confirmed deviations from documentation gaps and clarification items.
9. Attach evidence packets for material conclusions and calculation/graph proof for material numerical comparisons.
10. Produce a technical compliance matrix and handoff for Form 1, Form 2, unpriced schedule, and technical document selection.

## Skill Routing

- Use `tender-document-intake` when the requirement baseline is missing or weak.
- Use `supplier-quotation-normalizer` when supplier offers are not structured.
- Use `certificate-origin-review` for certificates, origin, ATEX/IECEx/IP/CoC/CoO, and documentation availability issues.
- Use `pdf`, `documents`, or `spreadsheets` for datasheets, drawings, certificates, and compliance matrices.
- Use `model-routing-policy` before `chatllm-call` for approved field extraction, comparison, or wording drafts; do not treat model output as final technical authority.
- Use `procurement-email-composer` for OEM/supplier technical confirmation emails, customer clarification emails, or deviation explanation emails. It must preserve technical uncertainty and show the draft in chat before Gmail draft/send actions.
- Use `quoteflow-neon` when reading or writing item records, selected offers, or compliance statuses.
- Hand off to `selected-offer-manager` when a technically acceptable final offer can be chosen.
- Hand off to `bid-forms-generator` for Form 2 exception generation after selected offers are frozen.

## Database Persistence

Persist final technical review results through `quoteflow-neon` before advancing the workflow:

- Inspect `technical_compliance_reviews` and write one review row per RFQ/item/supplier-offer scope when the live table supports it.
- Store the requirement-vs-offer matrix, evidence packet, numerical calculation proof, compliance result, risk level, deviation summary, approval/draft status, `rfq_id`, `item_id`, `company_id`, and `user_id` when columns exist.
- Update `supplier_item_status.compliance_deviation` only as the concise current status for that supplier/item. Do not use it as the only storage for the full compliance matrix or evidence.
- If `technical_compliance_reviews` is missing or unwritable, report the schema gap through `quoteflow-neon`, keep the structured review artifact for retry, and block stage advancement instead of pretending persistence succeeded.
- Do not hand off to certificate/origin, pricing, selection, forms, or QA as a completed stage until persistence succeeds or a blocker is recorded.

## Outputs

- Requirement vs Offered Comparison Matrix.
- Response Impact Technical Review Matrix for new customer/supplier/OEM/manufacturer/distributor replies.
- Evidence packet per material conclusion.
- Numerical Calculation and Graph/Table Proof Appendix when numerical technical values affect compliance.
- Technical compliance status per item and field.
- Fit/Form/Function/Application Suitability analysis.
- Technical deviation and exception register.
- OEM clarification questions.
- Final technical risk summary.
- Handoff notes for Form 1, Form 2, unpriced schedule, and technical attachments.
- Persistence status, including `technical_compliance_reviews` record references and any `supplier_item_status` rows updated.

## Failure Rules

- Never invent compliance, OEM equivalence, interchangeability, or functional suitability.
- Never issue a definitive `YES` or `NO` technical match conclusion without cited customer and supplier evidence, unless one side is explicitly absent and the conclusion is `BLOCKED/INSUFFICIENT EVIDENCE`.
- Never hide a confirmed technical deviation.
- Never classify a coding difference, legacy/current model change, or documentation gap as functional non-compliance without technical evidence.
- If safety, hazardous area, pressure, material, certification, or process compatibility is uncertain, flag it as blocking until confirmed.
- If customer and supplier sources conflict, preserve both and rank source authority.
- If a material numerical comparison is required, do not omit the calculation method or graph/table proof.
- Do not mark technical compliance complete if the review rows could not be persisted and no database blocker was recorded.
- Do not create final bid folders; hand off to bid form generation and packaging.

