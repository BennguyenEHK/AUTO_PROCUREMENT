---
name: selected-offer-manager
description: Manage the final selected supplier offer dataset for industrial tender submissions. Use when Codex needs to choose, validate, update, approve, lock, or freeze the final offered configuration per customer item before bid forms, pricing forms, technical attachments, QA, or final Technical Proposal and Commercial Proposal folders are generated.
---

# Selected Offer Manager

## Purpose

Create and protect the final selected-offer dataset as the single source of truth for all bid outputs. When the live schema supports it, `selected_offers` is the durable source-of-truth table.

Use this skill after RFQ/tender intake, supplier sourcing, quote normalization, technical comparison, certificate/origin review, and pricing have enough evidence to select one final offer per customer item.

Do not generate customer-facing final forms from supplier quotes, analysis tables, or assumptions directly. Generate them only from the selected-offer dataset.

## Workflow Stage

- Stage: `selected_offer`
- Previous stage: `commercial_pricing` or `certificate_origin_review`, depending on whether final pricing is required before selection.
- Next stage: `bid_forms_generation`.
- Stage owner: `bid-package-orchestrator`.
- State persistence: after one final offer per customer item is selected, validated, frozen, persisted to `selected_offers`, and re-read, use `quoteflow-neon` to update stage fields when the target RFQ row is clear. On success, append this stage to `completed_stages`, set `current_stage` to the orchestrator-selected next stage, set `stage_status` to `ready_for_next_stage` or `in_progress`, clear/refresh `stage_blockers`, and write `next_required_action`. On block, do not advance `current_stage`; set `stage_status = blocked`, populate `stage_blockers`, and set `next_required_action` to the unblock action.
- Boundary: this skill owns the selected-offer source of truth. It should not generate customer forms or final package ZIPs.
## Workflow

1. Load customer item requirements and identifiers.
2. Load normalized supplier quotations, technical compliance status, deviation status, certificate/origin review, and approved commercial pricing. If final customer pricing is required but `comercial-pricing` has not completed its user-approved pricing canvas/review packet and persisted official pricing, block selection and route back to `commercial_pricing`.
3. Select or confirm one final offered configuration per customer item ID.
4. Preserve exact fields:
   - Customer Item ID
   - Selected Supplier
   - Selected Manufacturer
   - Selected Offered Model
   - Selected Offered P/N
   - Selected Technical Description
   - Qty
   - UOM
   - Country of Origin
   - Lead Time
   - Certificates
   - Technical Status
   - Deviation Status
   - Final Selling Unit Price
   - Final Selling Total Price
5. Flag missing, conflicting, inferred, or unapproved values.
6. Verify every customer item has one and only one selected offer unless explicitly excluded.
7. Freeze the selected-offer dataset for downstream forms.
8. Persist the frozen dataset to `selected_offers` through `quoteflow-neon`, one active row per `(rfq_id, item_id)`, when the live table exists.
9. Re-read the persisted rows and confirm row count equals the final customer item scope before handoff.
10. Require explicit user approval before changing an approved final selling price, final selected model, final P/N, or final manufacturer.

## Database Persistence

Persist selected offers through `quoteflow-neon` before generating forms or proposal packages:

- Inspect `selected_offers` and upsert one row per `(rfq_id, item_id)` when the unique key or equivalent lookup exists.
- Store selected supplier, manufacturer, model, P/N, offered description, qty, UOM, country of origin, lead time, certificates, technical status, deviation status, final selling unit/total price, currency, approval status, frozen timestamp, approver, and evidence when columns exist.
- Link `supplier_item_status_id` and `quotation_id` when the selected source and quotation are clear.
- If `selected_offers` is missing or unwritable, report the schema gap through `quoteflow-neon`, keep the frozen artifact for retry, and block handoff to `bid-forms-generator`.
- Do not treat a chat table, report HTML, or temporary artifact as the frozen source of truth unless database persistence is unavailable and the blocker is explicit.

## Skill Routing

- Use `rfq-analysis` or `tender-document-intake` for original customer item requirements and source traceability.
- Use `suppliers-search` for supplier discovery outputs and supplier-offer context when offers are not yet available.
- Use `supplier-quotation-normalizer` for normalized supplier quote lines and commercial exceptions.
- Use `technical-compliance-review` for item technical status, deviation status, and fit/form/function risk.
- Use `certificate-origin-review` for certificate and origin status.
- Use `comercial-pricing` for approved final selling prices, totals, currency, VAT, quotation totals, and the pricing approval source.
- Use `quoteflow-neon` for reading or persisting selected offers, RFQ items, quotation records, pricing, and status.
- Use `model-routing-policy` before `chatllm-call` for approved controlled summarization/classification. Keep final selected-offer decisions, pricing, and approval changes in the main workflow.
- Hand off to `bid-forms-generator` only after the dataset is frozen, persisted to `selected_offers`, and re-read successfully, or after an explicit persistence blocker is reported.

## Outputs

- Final selected-offer table plus persisted `selected_offers` record references.
- Missing-information list.
- Conflict list.
- Technical deviation summary per item.
- Certificate/origin readiness summary.
- Price lock status.
- Pricing canvas/review packet approval status when final pricing is required.
- Downstream readiness status: `READY FOR FORMS`, `WARNING`, or `BLOCKED`.

## Failure Rules

- Do not infer manufacturing country from supplier country, brand country, OEM headquarters, or shipping country.
- Do not copy customer descriptions as offered descriptions when the selected supplier offered a different model or configuration.
- Do not mark an item ready if manufacturer, model/P/N, quantity, UOM, price, origin, or deviation status is unresolved.
- Do not freeze selected offers for priced customer submission when official pricing has not passed the `comercial-pricing` user approval gate.
- Do not hide confirmed deviations.
- Do not change user-approved final selling prices without explicit instruction.
- Do not allow multiple active selected offers for the same customer item ID unless clearly labeled as alternatives.
- Do not hand off to bid forms, QA, or submission when `selected_offers` persistence failed and no database blocker was recorded.
