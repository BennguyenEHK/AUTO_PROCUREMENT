---
name: suppliers-search
description: Search, verify, persist, and report supplier/product matches for QuoteFlow RFQ items. Use when Codex needs to source suppliers for procurement items, run supplier discovery from rfq_items, preserve item_id/company_description/qty/uom/agent_item_summary, coordinate model-routing-policy guided parallel discovery through $dispatch-parralel-agents and $chatllm-call, perform mandatory main Codex verification, write verified results through $quoteflow-neon, and create a scrollable HTML supplier-search report.
---

# Suppliers Search
## Web App Navigation

For normal supplier-search review, return `http://localhost:3000/?view=documents&tab=quotes&rfqId=<id>`. Do not generate or open a standalone supplier-search HTML report unless the customer explicitly requires that artifact; verify any required standalone path before returning it.

When editing this `SKILL.md` or supplier-search Markdown/control files, preserve UTF-8 without BOM and verify no BOM after edits when practical.

## Purpose

Run the QuoteFlow supplier sourcing workflow end to end:

```text
$quoteflow-neon -> $model-routing-policy -> $dispatch-parralel-agents + approved $chatllm-call discovery -> main Codex verification -> alternative search when coverage is weak -> $quoteflow-neon persistence -> QuoteFlow quotes deep link
```

The QuoteFlow quotes deep link is the normal final review surface, and database persistence is mandatory before final success. Do not dump the complete supplier result into chat.

## Workflow Stage

- Stage: `supplier_search`
- Previous stage: `tender_document_intake` or `rfq_analysis`.
- Next stage: `supplier_quote_normalization`.
- Stage owner: `bid-package-orchestrator`.
- State persistence: after supplier discovery, main Codex verification, `supplier_item_status` persistence, and report generation, use `quoteflow-neon` to update stage fields when the target RFQ row is clear. On success, append this stage to `completed_stages`, set `current_stage` to the orchestrator-selected next stage, set `stage_status` to `ready_for_next_stage` or `in_progress`, clear/refresh `stage_blockers`, and write `next_required_action`. On block, do not advance `current_stage`; set `stage_status = blocked`, populate `stage_blockers`, and set `next_required_action` to the unblock action.
- Boundary: this skill finds and verifies supplier/product candidates. It should not treat candidates as final quotations, perform final pricing, or generate customer-facing bid forms.
## Required Skills

- Use `$quoteflow-neon` for every database read, schema inspection, insert, update, or persistence decision.
- Use `$model-routing-policy` before external model calls or worker dispatch to choose the lightest safe route, privacy class, and complexity tier.
- Use `$dispatch-parralel-agents` to split discovery across items or search strategies.
- Use `$chatllm-call` with `gemini-3.5-flash` for fast discovery/search prompt packets. Default to public/redacted search terms only; send full private RFQ item content only when explicitly authorized and permitted by the tool layer.
- Use `$procurement-email-composer` for supplier RFQ/contact emails, quotation follow-ups, and supplier clarification drafts. Do not write supplier-facing email text directly here; the composer must show the draft in chat before any Gmail draft/send action.
- Use main Codex as the mandatory review and verification stage before any result is persisted or shown as verified.

## Database Preflight

Before discovery, use `$quoteflow-neon` on the main branch to inspect:

- `rfq_analysis`
- `rfq_items`
- `supplier_item_status`
- any other live table selected for persistence

If the matching `rfq_analysis` row has `current_stage = rfq_analysis_review`, `stage_status = pending_user_validation`, `stage_status = needs_review`, or `stage_blockers` showing `user_validation_pending`, do not run supplier discovery by default. Return the RFQ Analysis Report reference when available and ask for user approval to proceed. Continue only when the user explicitly approves/proceeds to supplier search or explicitly requests a test-mode skip/auto-run bypass.

Read procurement items from `rfq_items` and preserve these exact original values without rewriting or summarizing them:

- `item_id`
- `company_description`
- `qty`
- `uom`
- `agent_item_summary`

Use `company_id = 1` and `user_id = 1` unless the user supplies safer explicit context.

Important live-schema guardrail: `supplier_item_status` is the default persistence target for verified supplier search results. If it does not exist or lacks required columns, report the schema gap and route repair through `$quoteflow-neon`. If `suppliers_search_items` also exists in a future schema, inspect it as an optional secondary/reporting table only; do not prefer it over `supplier_item_status` without a clear workflow reason.

## Discovery Dispatch

Create parallel discovery packets with `$dispatch-parralel-agents`. Split by item when there are many items; split by search strategy when one item is complex.

Live Neon RFQ item content is private procurement data. By default, keep `rfq_id`, `item_id`, `qty`, `uom`, customer/project context, full `company_description`, and full `agent_item_summary` local. Derive public search terms locally, then send only those terms to `$chatllm-call`.

Example public/redacted ChatLLM packet:

```text
Find supplier/product pages for:
- Robinair vacuum pump 10 CFM 220V 50Hz
- Robinair 15120A
- Robinair 15121A
- HVAC refrigeration vacuum pump 10 CFM

Prioritize suppliers in this order:
1. Vietnam
2. Asia regional suppliers
3. Global suppliers

Return ONLY candidates that include a direct product page URL for the offered item or closest product match. Also search for same-supplier contact details, social/contact-form routes, currency, visible stock/available quantity, selling unit, and pack size. Return null for unavailable optional fields; do not skip the field.
```

After external discovery returns candidates, main Codex must compare them locally against the exact private RFQ item values from Neon. If full `company_description` or `agent_item_summary` must be sent to `$chatllm-call`, require explicit user approval and comply with any tool-layer approval result.

Use these discovery strategies in priority order:

1. Exact product/manufacturer/part-number search.
2. Authorized distributor and official manufacturer page search.
3. Reputable industrial supplier search.
4. Regional supplier search in this order: Vietnam first, then Asia, then global. When using `$chatllm-call`, explicitly instruct the selected model to prioritize Vietnam sources before widening the search.
5. Alternative product/supplier search only when exact coverage is insufficient, using the same Vietnam -> Asia -> global priority.

For every item, target at least 3 valid independent sources and preferably 5 or more. Prefer manufacturer pages, authorized distributors, official product pages, and reputable industrial suppliers.

Model-assisted discovery output must be JSON-like structured candidate data with:

- `supplier_name`
- `merchant_name`
- `manufacturer`
- `product_name`
- `product_page_url`
- `source_url`
- `source_type`
- `page_title`
- `other_information`
- `contact_email`
- `contact_phone`
- `social_contact`
- `contact_source_url`
- `bidder_unit_price`
- `currency_code`
- `delivery_time`
- `available_qty`
- `selling_unit`
- `pack_size`
- `image_urls`
- `claimed_match_type`
- `evidence_snippets`
- `discovery_notes`

For supplier-search packets sent to `$chatllm-call`, force the prompt to search every candidate for `contact_email`, `contact_phone`, `social_contact`, `currency_code`, `available_qty`, `selling_unit`, and `pack_size`. These keys must always be present in the returned JSON. If a value is not visible after searching the product page and verified same-supplier contact/source pages, return `null` and explain the gap in `discovery_notes`.

`product_page_url` is mandatory for a verified supplier-search source. It must be a direct product page for the offered item, exact part/model, or closest visible product listing. Do not accept a homepage, search-result page, generic catalog, or category page as a verified product page. If no direct product page exists, keep the candidate only as a lead with `claimed_match_type = lead_only`, `source_type = other`, and a clear missing-product-page note; do not count it as a satisfactory verified source.

For a satisfactory verified supplier candidate, at least one of `contact_email` or `contact_phone` is mandatory, and it must be tied to the same merchant/supplier shown on the product page. `social_contact` must still be searched and captured when available, but it does not replace the required email/phone route unless the user explicitly accepts that candidate as a low-confidence lead. Verify contact ownership by same domain, official supplier contact page, marketplace merchant profile, or product-page contact block. Do not mix manufacturer contacts, distributor contacts, marketplace contacts, or unrelated regional offices unless that entity is the supplier/merchant for the product page.

Only populate contact and commercial availability fields when they are visible on the product page or a verified same-supplier contact/source page. Do not invent, infer, or normalize from unsupported assumptions. Leave unknown values null/blank and preserve the missing-data note in `discovery_notes` or `evidence_snippets`.

Do not require the external model to know the private `item_id`. Map candidates back to `item_id` locally after main Codex verification. Discovery is candidate generation only. Never treat model-assisted discovery output as final.

## Mandatory Main Codex Verification

After discovery, main Codex must review every candidate before persistence or reporting:

- Verify source relevance and accessibility.
- Verify `product_page_url` is a direct product page and map it to the persisted `source_url`.
- Remove duplicate suppliers, duplicate URLs, and duplicate product pages.
- Compare each result against the exact original item values and `agent_item_summary`.
- Verify same-supplier contact ownership before persistence, including `contact_email`, `contact_phone`, `social_contact`, and `contact_source_url`.
- Verify price, currency, stock/available quantity, selling unit, and pack size only from visible source evidence before persistence.
- Classify each candidate as `exact_match` or `alternative`.
- Calculate `match_score` from 0 to 100.
- Provide a concise `match_reason`.
- Identify technical differences clearly.
- Rank the best supplier/product results per item.

Use this scoring guide:

- `90-100`: exact manufacturer/model/specification match with reliable source.
- `75-89`: strong match with minor unblocked differences or missing commercial detail.
- `55-74`: plausible alternative with known technical differences.
- `<55`: weak, speculative, inaccessible, or insufficiently supported; exclude from satisfactory sources unless explicitly useful as a lead.

Never present an alternative as an exact match.

## Alternative Search Rule

If fewer than 5 satisfactory sources remain for an item after verification, run an additional alternative-product/supplier search. For each alternative, include:

- matched requirements
- different requirements
- reason the alternative may be technically acceptable

If fewer than 3 verified sources exist even after alternatives, report the shortage in the item section and preserve the best verified leads.

## Image Rule

For every item, collect at least 1 relevant product image and preferably 3. Prefer official manufacturer or reliable supplier images. Keep image URLs tied to the verified product/source. Do not use decorative or unrelated stock images.

## Persistence Rules

Persist only verified results. Use `$quoteflow-neon` and inspect the live target table schema immediately before writing.

Rules:

- Persist verified supplier-search rows to `supplier_item_status` by default before claiming the supplier-search stage is complete.
- Preserve the relationship to the original `rfq_items.item_id` and `rfq_id`.
- Use the existing schema exactly. Never invent columns, run DDL, or silently modify database structure.
- Do not write external-model-only candidates.
- Do not write inaccessible, duplicate, or unverified sources.
- Do not write homepage/category/search-result URLs as verified supplier sources. Store the direct product page URL in `source_url`; if only a non-product URL exists, keep it out of verified persistence unless the user explicitly accepts low-confidence leads.
- Do not guess missing supplier contact or commercial availability values. Store exact source-supported values only; otherwise leave the field null/blank and explain the gap in `notes` or `evidence`.
- Use scoped inserts/updates with `company_id = 1`, `user_id = 1` when columns exist.
- If the target table has no uniqueness constraint, check for existing rows by `rfq_id`, `item_id`, `supplier_name`, and `source_url` before inserting duplicates.

Known compatible `supplier_item_status` fields:

- `rfq_id`, `item_id`, `company_id`, `user_id`
- `supplier_name`, `source_url`, `manufacturer`, `bidder_description`
- `contact_email`, `contact_phone`, `social_contact`
- `status`, `notes`, `compliance_deviation`, `match_reasoning`
- `requires_quote`, `page_type`, `extraction_confidence`, `item_origin`, `evidence`
- commercial fields when available: `bidder_unit_price`, `currency_code`, `delivery_time`, `available_qty`, `selling_unit`, `pack_size`

Recommended mapping for `supplier_item_status`:

- `supplier_name` -> verified supplier name
- `source_url` -> verified clickable direct product page URL
- `manufacturer` -> verified manufacturer/OEM when source-supported
- `status` -> `verified` for retained verified rows. Keep values short because live `supplier_item_status.status` may be length-limited.
- `bidder_description` -> concise product/supplier information
- `contact_email` -> source-supported supplier sales/RFQ/contact email from the product page or verified same-supplier contact page
- `contact_phone` -> source-supported supplier phone number from the product page or verified same-supplier contact page
- `social_contact` -> source-supported WhatsApp/LinkedIn/contact-form/social handle from the same supplier/merchant when available
- `bidder_unit_price` -> visible numeric unit price only; otherwise leave null/blank
- `currency_code` -> visible ISO code or unmistakable currency label such as USD, EUR, VND; keep ambiguous symbols in `evidence` instead of guessing
- `delivery_time` -> visible lead time, delivery time, or stock timing text
- `available_qty` -> exact visible numeric available quantity only; store vague stock text in `notes` or `evidence`
- `selling_unit` -> visible selling unit such as EA, PCS, SET, LOT, BOX, or supplier-stated unit
- `pack_size` -> exact visible numeric pack size only
- `match_reasoning` -> match type, score, and match reason
- `compliance_deviation` -> technical differences, or `None`
- `notes` -> alternative reason, image URLs, accessibility notes, ranking, merchant-name differences, and missing contact/commercial fields
- `evidence` -> compact JSON text with source type, page title, direct product page URL, merchant name, snippets, image URLs, contact evidence URL, commercial evidence URL, verification timestamp, and verifier
- `requires_quote` -> true when price/stock requires supplier contact
- `page_type` -> short live-safe values such as `mfr`, `auth_dist`, `supplier`, `market`, or `other`. Keep at 12 characters or fewer for `supplier_item_status`.
- `extraction_confidence` -> `high`, `medium`, or `low`

If `suppliers_search_items` exists, inspect it and build a fresh optional mapping from its actual columns. Do not assume it matches `supplier_item_status`, and do not use it as the only persistence target.

## Report Output

Use `http://localhost:3000/?view=documents&tab=quotes&rfqId=<id>` after all RFQ items have a reportable verified source. Generate a standalone HTML artifact only when the customer explicitly requires it.

The report must be vertically scrollable, searchable by item/supplier/source/match reason, and display every item's exact original values:

- `item_id`
- `company_description`
- `qty`
- `uom`
- `agent_item_summary`

The report JSON must also include the RFQ baseline from `rfq_analysis` when those columns exist, so the report answers the RFQ-analysis handoff questions before listing supplier candidates:

- deadline / closing time / delivery deadline when identified;
- special/further requirements as separate fields when available: COO/origin, certificates, standards, inspection, documentation, manufacturer authorization, Incoterms, currency, quotation validity, payment terms, bid bonds, technical/commercial forms, plus commercial, technical, submission, and compliance groupings when those are the stored RFQ-analysis buckets;
- required documents;
- clarifications or missing information.

Do not pass raw `agent_item_summary` JSON as the only readable item context. Preserve the original structured value, but rely on `report-generator` to render it as professional labeled sections.

For each item, show 1-3 product images and at least 3 verified sources whenever 3 valid sources exist. Each supplier result must display:

- supplier name
- clickable direct product page link
- contact email / phone / social contact when available
- price, currency, delivery time, available quantity, selling unit, and pack size when available
- other relevant supplier/product information
- match type
- match score
- match reason
- technical differences
- alternative reason

Final chat response should return the canonical quotes deep link and summarize only counts, `supplier_item_status` inserted/updated/skipped counts, persistence status, and major gaps.

## Failure Handling

- Missing or ambiguous RFQ/item context: stop and ask for `rfq_id`, RFQ reference, or item scope.
- Missing or unwritable `supplier_item_status`: create the report only if useful, but mark the stage blocked for database persistence and do not claim supplier-search completion.
- ChatLLM unavailable or network-blocked: use direct Codex/web discovery when possible and report the skipped model-assisted discovery stage. For `$chatllm-call`, use the `call_chatllm.ps1` entrypoint with normal Abacus CLI arguments such as `--model <model> -p "<prompt>"`; keep JSON instructions inside the prompt and validate returned JSON before using it.
- Full private RFQ item transfer to ChatLLM blocked or not approved: continue with redacted/public search-term discovery and local verification.
- Source inaccessible: exclude from verified results or mark as a low-confidence lead, never as a satisfactory source.
- Fewer than 3 valid sources: run alternative search, then report the remaining shortage clearly.
- Database write failure: do not claim persistence succeeded; include table, branch, and failed scope in the final summary.

## Final Checklist

- Items read from `rfq_items` with exact original values preserved.
- Parallel discovery dispatched through `$dispatch-parralel-agents`.
- Model-assisted discovery uses redacted/public search terms by default and is treated as candidates only.
- Main Codex verification completed for every retained source.
- Alternatives searched when fewer than 5 satisfactory sources remain.
- Product images collected where available.
- Source-supported contact and commercial availability fields extracted and persisted when visible; unknown values left null/blank with gaps explained in notes/evidence.
- Target table schema inspected immediately before write.
- Verified results persisted to `supplier_item_status` through `$quoteflow-neon`, with inserted/updated/skipped counts, or persistence gap reported as a blocker.
- `report.html` created and linked as the primary output.
