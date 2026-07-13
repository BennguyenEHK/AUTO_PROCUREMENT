---
name: supplier-quotation-normalizer
description: Extract, normalize, compare, and map supplier quotations, proformas, email offers, distributor replies, and technical/commercial offers against customer tender item IDs. Use when Codex needs structured supplier quote data including offered manufacturer/model/P/N, qty, UOM, price, lead time, validity, Incoterm, warranty, certificates, exclusions, optional costs, quote revisions, mapping confidence, and supplier quotation exceptions before compliance review, pricing, selected-offer management, or bid package generation.
---

# Supplier Quotation Normalizer
## Local Artifact Links

When returning local artifacts, resolve the actual absolute Windows path; use Windows links (and browser-safe `file:///C:/...` for HTML), never `/mnt/c/...` or `C:/mnt/c/...`.

## Purpose

Turn supplier offers into structured, comparable, traceable quotation data. Detect commercial and technical quote exceptions before pricing, offer selection, compliance review, or final bid generation.

## Workflow Stage

- Stage: `supplier_quote_normalization`
- Previous stage: `supplier_search`, `rfq_analysis`, or `new` when supplier quotations are uploaded/received before formal supplier search.
- Next stage: `technical_compliance_review`.
- Stage owner: `bid-package-orchestrator`.
- State persistence: after quote extraction, customer-item mapping, arithmetic checks, exception reporting, and `supplier_quote_normalizations` persistence, use `quoteflow-neon` to update stage fields when the target RFQ row is clear. On success, append this stage to `completed_stages`, set `current_stage` to the orchestrator-selected next stage, set `stage_status` to `ready_for_next_stage` or `in_progress`, clear/refresh `stage_blockers`, and write `next_required_action`. On block, do not advance `current_stage`; set `stage_status = blocked`, populate `stage_blockers`, and set `next_required_action` to the unblock action.
- Boundary: this skill structures supplier quotations and quote exceptions. It should not approve technical compliance, freeze selected offers, or generate final bid documents.
## Workflow

1. Collect supplier quote sources: PDFs, Excel files, Word documents, emails, attachments, revised offers, clarifications, and addenda.
2. Extract supplier header data: supplier, quote number, quote date, revision, validity, currency, Incoterm, payment terms, warranty, freight/packing/documentation notes, and general exclusions.
3. Extract every supplier line:
   - supplier line number, mapped customer item ID, offered manufacturer, model, P/N, description, qty, UOM, unit price, total price, lead time, certificates, warranty, origin statement, and notes.
4. Map each supplier line to a customer item ID using item number, tag, description, manufacturer/model/P/N, quantity, UOM, and technical group.
5. Mark mapping confidence as `CONFIRMED`, `LIKELY`, or `MAPPING CLARIFICATION REQUIRED`.
6. Detect unmapped, duplicate, missing, wrong-quantity, wrong-UOM, optional, alternate, bundled, or excluded lines.
7. Check arithmetic: unit price x qty, line totals, subtotal, VAT/tax, freight, documentation costs, grand total, and currency consistency.
8. Extract assumptions and exclusions: certificates not included, freight excluded, origin unconfirmed, validity short, partial delivery, alternative model, documentation costs, no export availability, or pending OEM confirmation.
9. Preserve supplier wording for deviations, exclusions, lead time, validity, Incoterm, and certificate availability.
10. Produce normalized supplier quote tables and a Supplier Quotation Exception Report.

## Database Persistence

Persist normalized quote results through `quoteflow-neon` before advancing the workflow:

- Inspect `supplier_quote_normalizations` and write one normalized record per supplier quote/item mapping where the live table supports it.
- Store the normalized quote payload, exception report, arithmetic check, supplier name, quote reference/source, `rfq_id`, `item_id`, `company_id`, and `user_id` when columns exist.
- Reconcile clear quote fields back to `supplier_item_status` when a supplier/item status row is known, including bidder price, currency, delivery time, bidder description, manufacturer, item origin, and evidence.
- If `supplier_quote_normalizations` is missing or unwritable, report the schema gap through `quoteflow-neon`, keep the structured artifact for retry, and block stage advancement instead of pretending persistence succeeded.
- Do not hand off to `technical-compliance-review` as a completed stage until the persistence result is saved or a blocker is recorded.

## Skill Routing

- Use `pdf`, `documents`, or `spreadsheets` to extract quote contents by file type.
- Use `gmail:gmail` when supplier offers are in email threads.
- Use `procurement-email-composer` when quote gaps, mapping conflicts, certificate exclusions, validity issues, or commercial assumptions require a supplier clarification/follow-up email. Show the draft in chat before Gmail draft/send actions.
- Use `quoteflow-neon` when normalized quote data must be persisted or reconciled with RFQ items, supplier status, or quotation tables.
- Use `model-routing-policy` before `chatllm-call` for approved text normalization or JSON extraction; keep quote prices, exclusions, and supplier terms local unless approved for external model use.
- Use `tender-document-intake` when the customer item baseline or technical groups are missing.
- Hand off to `technical-compliance-review` after offered models/P/N/descriptions are structured.
- Hand off to `certificate-origin-review` when certificates or origin are included, excluded, unclear, or customer-required.
- Hand off to `comercial-pricing` only after quote normalization and exception detection show enough commercial basis for pricing. If supplier quantity, currency, validity, freight, tax/VAT, Incoterm, optional costs, or price basis is unresolved, block final pricing and list the required clarification instead of starting the pricing canvas as final.
- Hand off to `selected-offer-manager` after technically and commercially viable quote options are known.

## Outputs

- Normalized Supplier Quotation Table.
- Customer item to supplier line mapping.
- Supplier Quotation Exception Report.
- Commercial arithmetic check.
- Missing/duplicate/wrong-quantity list.
- Supplier assumption and exclusion register.
- Pricing and compliance handoff dataset.
- Persistence status, including `supplier_quote_normalizations` record references and any `supplier_item_status` rows updated.

## Failure Rules

- Do not map a supplier line to a customer item when evidence is weak; mark `MAPPING CLARIFICATION REQUIRED`.
- Do not treat optional costs as included base price unless supplier explicitly states so.
- Do not infer certificate inclusion, freight inclusion, warranty, origin, export availability, or Incoterm.
- Do not overwrite user-approved selling prices.
- Do not present supplier quote arithmetic as official final selling pricing; official pricing must pass through `comercial-pricing` and its user approval gate.
- If quote revisions conflict, preserve revision/date and ask which revision controls unless evidence is clear.
- Do not expose supplier purchase costs or internal margins in customer-facing outputs.
- Do not mark quote normalization complete if normalized quote rows could not be persisted and no database blocker was recorded.
