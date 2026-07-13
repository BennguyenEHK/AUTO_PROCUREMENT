---
name: certificate-origin-review
description: Review customer certificate, documentation, and country-of-origin requirements against supplier offers, manufacturer data, certificates, declarations, datasheets, and tender submission requirements. Use when Codex needs a certificate matrix, origin matrix, CoC/CoO/EN 10204/PMI/calibration/hydro/proof test/ATEX/IECEx/IP/CE/DoC/warranty/GAD/datasheet status, bid-stage vs delivery-stage document review, or origin clarification before compliance review, selected-offer approval, technical attachments, or final bid packaging.
---

# Certificate Origin Review
## Local Artifact Links

When returning local artifacts, resolve the actual absolute Windows path; use Windows links (and browser-safe `file:///C:/...` for HTML), never `/mnt/c/...` or `C:/mnt/c/...`.

## Purpose

Create a defensible certificate and origin matrix. Distinguish required, offered, included, unavailable, delivery-stage, chargeable, and clarification-needed documents.

Prevent unsupported origin or certificate claims.

## Workflow Stage

- Stage: `certificate_origin_review`
- Previous stage: `technical_compliance_review`.
- Next stage: `commercial_pricing` when pricing is not complete, otherwise `selected_offer`.
- Stage owner: `bid-package-orchestrator`.
- State persistence: after certificate matrix, origin matrix, attachment handoff, clarification blockers, and `certificate_origin_reviews` persistence are complete, use `quoteflow-neon` to update stage fields when the target RFQ row is clear. On success, append this stage to `completed_stages`, set `current_stage` to the orchestrator-selected next stage, set `stage_status` to `ready_for_next_stage` or `in_progress`, clear/refresh `stage_blockers`, and write `next_required_action`. On block, do not advance `current_stage`; set `stage_status = blocked`, populate `stage_blockers`, and set `next_required_action` to the unblock action.
- Boundary: this skill controls certificate/document/origin evidence. It should not infer origin, approve final pricing, or generate final proposal folders.
## Workflow

1. Load customer certificate, documentation, and country-of-origin requirements from tender intake, RFQ analysis, or source tender documents.
2. Load supplier quotation, technical offer, datasheets, certificates, declarations, and written confirmations.
3. Create a Certificate Matrix with:
   - certificate, customer requirement, supplier offer, included in price, available with bid, available with delivery, clarification required, comments, and source reference.
4. Check applicable documents:
   - CoC, Certificate of Compliance, Certificate of Conformity, Certificate of Origin, Country of Manufacture, EN 10204 3.1, PMI, calibration, hydro test, proof test, ATEX, IECEx, IP certificate, CE Declaration, DoC, warranty certificate, GAD, drawings, 3D model, and datasheets.
5. Distinguish supplier country, brand country, OEM headquarters, manufacturing country, shipping country, and legally usable country of origin.
6. Identify excluded, chargeable, unavailable, expired, product-family-only, delivery-stage, or bid-stage documents.
7. Check whether documents support the exact offered manufacturer/model/P/N, not only a legacy or similar product.
8. Flag customer-facing risks:
   - missing bid-stage certificate;
   - origin restriction not confirmed;
   - required certificate excluded from price;
   - documentation not aligned with offered model;
   - certificate available only after delivery.
9. Draft supplier/OEM/customer clarification questions where evidence is insufficient.
10. Produce certificate/origin handoff for compliance review, selected offer, technical attachments, and final QA.

## Skill Routing

- Use `tender-document-intake` to obtain customer certificate/origin baseline.
- Use `supplier-quotation-normalizer` to obtain supplier certificate inclusions, exclusions, costs, lead time, and offer notes.
- Use `technical-compliance-review` when certificate or documentation gaps affect technical compliance or Form 2 exceptions.
- Use `pdf`, `documents`, or `spreadsheets` to inspect certificates, declarations, datasheets, and matrices.
- Use `gmail:gmail` when supplier/OEM confirmations are in email.
- Use `procurement-email-composer` for certificate, documentation, country-of-origin, and manufacturer-confirmation request emails. It must avoid unsupported origin/certificate claims and show the draft in chat before Gmail draft/send actions.
- Use `google-drive` when certificates or project files are stored in Drive.
- Use `quoteflow-neon` when certificate/origin status must be persisted.
- Hand off to `selected-offer-manager`, `bid-forms-generator`, and `submission-qa-packager` when final offer, forms, or attachment packages are being prepared.

## Database Persistence

Persist certificate and origin review results through `quoteflow-neon` before advancing the workflow:

- Inspect `certificate_origin_reviews` and write one review row per RFQ/item/supplier-offer scope when the live table supports it.
- Store the certificate matrix, origin matrix, document register, blockers, evidence packet, review status, `rfq_id`, `item_id`, `company_id`, and `user_id` when columns exist.
- Update `supplier_item_status.item_origin`, `manufacturer`, and compact evidence only when the exact supplier/item status row is clear. Do not infer origin from supplier country or brand country.
- If `certificate_origin_reviews` is missing or unwritable, report the schema gap through `quoteflow-neon`, keep the structured review artifact for retry, and block stage advancement instead of pretending persistence succeeded.
- Do not hand off to pricing, selected offer, forms, or QA as a completed stage until persistence succeeds or a blocker is recorded.

## Outputs

- Certificate Matrix.
- Origin Review Matrix.
- Certificate inclusion/exclusion register.
- Bid-stage vs delivery-stage document list.
- Supplier/OEM/customer clarification questions.
- Technical/commercial risk notes related to certificate cost, availability, and origin.
- Final attachment selection handoff.
- Persistence status, including `certificate_origin_reviews` record references and any `supplier_item_status` rows updated.

## Failure Rules

- Never infer manufacturing origin from supplier location, brand country, OEM headquarters, or shipping country.
- Never claim certificate availability unless supplier, OEM, manufacturer data, or project evidence supports it.
- Never attach irrelevant certificates for different models unless clearly marked as reference only.
- If certificate availability affects price, flag it for commercial review.
- If customer requires a certificate at bid stage and it is only available with delivery, mark it as a submission risk.
- If exact offered model/P/N is not covered by certificate evidence, flag `DOCUMENTATION GAP` or `CLARIFICATION REQUIRED`.
- Do not mark certificate/origin review complete if the review rows could not be persisted and no database blocker was recorded.

