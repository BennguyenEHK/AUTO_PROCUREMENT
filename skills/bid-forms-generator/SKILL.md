---
name: bid-forms-generator
description: Generate formal industrial tender bid forms from the frozen selected-offer dataset. Use when Codex needs to create Form 1 Technical Proposal, Form 2 Technical Exceptions, Form 3 Master Terms Compliance, priced Form 4, unpriced Form 4, Part A/RFP General forms, bid submission letter, signed PDFs, native editable files, or customer-prescribed technical/commercial form outputs.
---

# Bid Forms Generator
## Local Artifact Links

When returning local artifacts, resolve the actual absolute Windows path; use Windows links (and browser-safe `file:///C:/...` for HTML), never `/mnt/c/...` or `C:/mnt/c/...`.

## Purpose

Generate customer-facing bid forms using the frozen selected-offer dataset as the only technical and commercial source of truth.

Use this skill for Form 1, Form 2, Form 3, priced Form 4, unpriced Form 4, Part A, bid submission letter, native editable files, and signed PDF outputs.

## Workflow Stage

- Stage: `bid_forms_generation`
- Previous stage: `selected_offer`.
- Next stage: `submission_qa`; rollback to `technical_compliance_review` or `selected_offer` if form generation exposes requirement, deviation, pricing, or selected-offer gaps.
- Stage owner: `bid-package-orchestrator`.
- State persistence: after required native files and signed PDFs are generated or blockers are identified, use `quoteflow-neon` to update stage fields when the target RFQ row is clear. On success, append this stage to `completed_stages`, set `current_stage` to the orchestrator-selected next stage, set `stage_status` to `ready_for_next_stage` or `in_progress`, clear/refresh `stage_blockers`, and write `next_required_action`. On block, do not advance `current_stage`; set `stage_status = blocked`, populate `stage_blockers`, and set `next_required_action` to the unblock action.
- Boundary: this skill generates customer-facing bid forms from the frozen selected-offer dataset. It should not mark the package ready for submission without final QA.
## Workflow

1. Confirm the selected-offer dataset is frozen, complete, persisted to `selected_offers`, re-read from `quoteflow-neon`, and approved for form generation. For priced forms, also confirm `comercial-pricing` has completed the user-approved pricing canvas/review packet or explicit direct-pricing approval, and official pricing is persisted.
2. Load customer-prescribed forms, submission instructions, package separation rules, bidder details, authorized signatory data, signature, seal, and required native/PDF formats.
3. Preserve customer wording, legal declarations, item order, form structure, and required native formats.
4. Generate required forms:
   - Form 1 Technical Proposal.
   - Form 2 Technical Exceptions.
   - Form 3 Master Terms Compliance.
   - Form 4 Schedule of Prices, priced.
   - Form 4 Schedule of Prices, unpriced.
   - Part A / RFP Forms General.
   - Bid Submission Letter.
5. For Form 1, use selected supplier offer data for offered description, model, P/N, manufacturer, country of origin, lead time, certificates, delivery term, and supporting documents.
6. For Form 2, disclose real technical differences and classify them using approved deviation categories.
7. For Form 3, mark full compliance only if no contractual exception exists.
8. For priced Form 4, preserve customer pricing structure and populate only approved final selling prices from persisted official pricing.
9. For unpriced Form 4, derive directly from final priced Form 4 and remove only commercial values.
10. Apply signature, seal, date, and authorized signatory rules where required.
11. Produce native editable files and signed PDFs as required.

## Skill Routing

- Require `selected-offer-manager` and the re-read `selected_offers` rows as the source for all selected offer fields.
- Use `technical-compliance-review` for Form 2 exception content and technical deviation reasoning.
- Use `certificate-origin-review` for certificate, origin, and technical attachment references.
- Use `comercial-pricing` for final approved selling prices, totals, currency, VAT, commercial calculations, and pricing approval source.
- Use `report-generator` for QuoteFlow-native technical/commercial supplier proposal HTML/PDF documents when those are required alongside formal customer forms.
- Use `documents` for Word/PDF-style forms, Part A, bid letters, declarations, and signed documents when customer-prescribed forms require them.
- Use `spreadsheets` for Excel-native schedules, Form 1 tables, Form 4 tables, formulas, and priced/unpriced comparison.
- Use `pdf` for rendering, signed/sealed PDF output, and visual QA.
- Use `quoteflow-neon` when forms must read persisted RFQ, company, selected-offer, or pricing records.
- Hand off to `submission-qa-packager` after generation for cross-document QA and final folders.

## Outputs

- Form 1 Technical Proposal native file and signed PDF.
- Form 2 Technical Exceptions signed PDF.
- Form 3 Master Terms Compliance signed PDF.
- Form 4 priced native Excel and signed PDF.
- Form 4 unpriced native Excel and signed PDF.
- Part A signed PDF.
- Bid Submission Letter signed PDF.
- Form generation log with source dataset version and warnings.

## Failure Rules

- Do not generate forms from non-final supplier quotes or draft analysis.
- Do not generate forms from selected-offer data that has not been persisted to and re-read from `selected_offers`, unless a database blocker is explicitly recorded.
- Do not generate priced customer forms from unapproved pricing variables, draft supplier prices, or pricing that bypassed the `comercial-pricing` user approval gate.
- Do not rewrite customer-prescribed legal wording unless explicitly instructed.
- Do not put prices, total amount, supplier costs, internal margin, potential profit, or other internal commercial values in the unpriced technical form or technical supplier proposal.
- Do not omit known technical deviations from Form 2.
- Do not select full contractual compliance if a real contractual exception exists.
- Do not use unauthorized signatories.
- Do not mark forms complete until required native and signed PDF outputs exist.
