---
name: submission-qa-packager
description: Perform final cross-document QA and package industrial tender submission folders and ZIP files. Use when Codex needs to validate technical/commercial proposal consistency, check priced vs unpriced forms, verify signatures and seals, select final technical attachments, generate Technical Proposal and Commercial Proposal folders, create ZIP files, produce a Final Bid QA Report, or prepare a short customer cover email.
---

# Submission QA Packager
## Local Artifact Links

When returning local artifacts, resolve the actual absolute Windows path; use Windows links (and browser-safe `file:///C:/...` for HTML), never `/mnt/c/...` or `C:/mnt/c/...`.

## Purpose

Verify, assemble, and package the final tender submission. This skill is the submission gatekeeper.

The workflow is not complete until the Technical Proposal folder, Commercial Proposal folder, required ZIP files, Final Bid QA Report, and short customer cover email are produced, unless a blocker is explicitly reported.

## Workflow Stage

- Stage: `submission_qa`
- Previous stage: `bid_forms_generation`.
- Next stage: `ready_for_submission` when no `CRITICAL` issue remains, otherwise `blocked`.
- Stage owner: `bid-package-orchestrator`.
- State persistence: after final QA, folder generation, ZIP creation, QA report, and cover email draft status are complete, use `quoteflow-neon` to update stage fields when the target RFQ row is clear. On success, append this stage to `completed_stages`, set `current_stage` to `ready_for_submission`, set `stage_status` to `complete`, clear/refresh `stage_blockers`, and write `next_required_action`. On block, do not advance `current_stage`; set `stage_status = blocked`, populate `stage_blockers`, and set `next_required_action` to the unblock action.
- Boundary: this skill is the final packaging and QA gate. It must not mark `READY FOR SUBMISSION` while a `CRITICAL` issue remains.
## Workflow

1. Load the frozen selected-offer dataset by re-reading `selected_offers` through `quoteflow-neon`.
2. Load all generated bid forms, native editable technical/commercial proposal HTML files, technical attachments, pricing files, signature/seal assets, customer submission instructions, and package separation rules.
3. Select only technical documents supporting final offered products.
4. Map every selected attachment to offered product, supporting datasheet, supporting certificate, drawing, or other required document.
5. Rename attachments professionally, such as `ATT-01_[Manufacturer]_[Product]_Datasheet.pdf`, and create a Technical Document Index.
6. Build `Technical Proposal/` with required files:
   - `01_Part_A_RFP_Forms_General.pdf`
   - `02_Bid_Submission_Letter.pdf`
   - `03_Form_1_Technical_Proposal_Signed.pdf`
   - `03_Form_1_Technical_Proposal_Native.xlsx`
   - `04_Form_2_Technical_Exceptions.pdf`
   - `05_Form_3_Master_Terms_Compliance.pdf`
   - `06_Form_4_Schedule_of_Prices_UNPRICED_Signed.pdf`
   - `06_Form_4_Schedule_of_Prices_UNPRICED_Native.xlsx`
   - `07_Technical_Documents/`
7. Build `Commercial Proposal/` with required files:
   - `01_Part_A_RFP_Forms_General.pdf`
   - `02_Form_2_Technical_Exceptions.pdf`
   - `03_Form_3_Master_Terms_Compliance.pdf`
   - `04_Form_4_Pricing_Table_Signed.pdf`
   - `04_Form_4_Pricing_Table_Native.xlsx`
8. Add Bid Submission Letter, Commercial Quotation, or Commercial Conditions to the commercial folder only when customer instructions require them.
9. Run cross-document QA:
   - Technical QA: every item covered, selected model/P/N/manufacturer/qty/UOM correct, critical attributes checked, deviations disclosed, and technical proposal HTML contains no unit price, extended price, subtotal, VAT, or total amount.
   - Priced vs unpriced QA: same item sequence, description, P/N, manufacturer, qty, UOM; only commercial values differ.
   - Commercial QA: commercial proposal HTML includes approved currency, unit prices, extended prices, totals, VAT when applicable, Incoterm, lead time, and validity.
   - Form QA: RFP number, package name, date, bidder, representative, signatory, signatures, seals.
   - Consistency QA: manufacturer, model, P/N, description, qty, UOM, origin, lead time, Incoterm, VAT, warranty, deviations, total price.
10. Assign each issue `PASS`, `WARNING`, or `CRITICAL`.
11. Block `READY FOR SUBMISSION` if any `CRITICAL` issue remains.
12. Create Technical Proposal ZIP, Commercial Proposal ZIP, and Complete Submission Package ZIP only when QA permits packaging.
13. Call `procurement-email-composer` to prepare the short customer cover email from verified package/RFQ facts and show it in chat for approval.
14. Produce Final Bid QA Report and approved short customer cover email.

## Skill Routing

- Require `selected-offer-manager` and re-read `selected_offers` rows to compare every final file against the single source of truth.
- Require `bid-forms-generator` as the source for final generated forms.
- Use `technical-compliance-review` and `certificate-origin-review` to verify deviations, certificates, origin, and attachment relevance.
- Use `documents` for bid letters, Part A, signed PDFs, document indexes, and QA report when customer-prescribed forms require them.
- Use `spreadsheets` only for customer-prescribed Excel schedules when unavoidable; do not use spreadsheet plugins for QuoteFlow technical/commercial proposal generation.
- Use `pdf` only for non-proposal visual checks when unavoidable; do not use PDF plugins for QuoteFlow technical/commercial proposal generation.
- Use `report-generator` for native editable technical/commercial proposal HTML only. Proposal PDFs are created manually by the user from the HTML browser Print / Save PDF dialog when needed.
- Use `quoteflow-neon` when final package status or QA results must be persisted.

## Outputs

- `Technical Proposal/` folder.
- `Commercial Proposal/` folder.
- Technical Proposal ZIP.
- Commercial Proposal ZIP.
- Complete Submission Package ZIP.
- Final Bid QA Report.
- Technical Document Index.
- Short Customer Cover Email.
- `READY FOR SUBMISSION` or `BLOCKED` status.

## Failure Rules

- Do not expose supplier costs, internal margins, internal analysis, or supplier quotations in customer-facing folders.
- Do not start final QA from a chat-only or HTML-only selected-offer dataset when persisted `selected_offers` rows are available or required.
- Do not accept a technical proposal file that contains visible unit price, extended price, subtotal, VAT, total amount, internal margin, or potential profit.
- Do not accept a commercial proposal file if approved unit prices, extended prices, totals, currency, or terms are missing when required.
- Do not include irrelevant legacy datasheets unless required for technical comparison.
- Do not create final ZIPs if a `CRITICAL` issue remains.
- Do not mark unpriced Form 4 valid unless it mirrors priced Form 4 except for commercial values.
- Do not mark signatures/seals complete without checking required forms.
- Do not stop at QA tables; final folders and ZIPs are required.


