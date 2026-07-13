---
name: procurement-email-composer
description: Compose professional, polite, procurement-safe customer and supplier emails for RFQs, quotations, clarifications, follow-ups, technical deviations, certificate/origin requests, supplier RFQs, and bid submission cover emails. Use when Codex needs to draft procurement email text with verified RFQ, customer, supplier, item, price, delivery, certificate, origin, or workflow facts; lookup customer/supplier contacts through QuoteFlow Neon; read or prepare Gmail replies/drafts through Gmail; and always show the draft in chat for user validation before any Gmail draft or send action.
---

# Procurement Email Composer

## Purpose

Draft accurate, professional procurement emails without inventing commercial or technical facts.

This skill is a composition and governance layer. It does not replace `gmail:gmail` or `quoteflow-neon`.

- Use `gmail:gmail` for all live Gmail search, read, thread, draft, reply, forward, label, archive, and send operations.
- Use `quoteflow-neon` for all QuoteFlow database fetching, schema inspection, RFQ context, customer contact lookup, supplier contact lookup, and persistence.
- Show the email draft in chat first and wait for explicit user validation before creating a Gmail draft or sending.

## Email Types

Use this skill for:

- supplier RFQ/request for quotation;
- supplier quotation follow-up;
- supplier clarification or document request;
- OEM/manufacturer technical confirmation request;
- customer clarification request;
- customer status update;
- technical deviation explanation;
- certificate or country-of-origin request;
- bid submission cover email;
- polite rewrite or tone improvement of procurement emails.

For simple rewrites where the user provides all text and no factual claims need checking, do not query the database unless the user asks.

## Source Rules

Before drafting an email with factual procurement content, classify each fact as:

- `VERIFIED FACT`: confirmed by QuoteFlow database, Gmail thread, source file, supplier quotation, customer RFQ, or manufacturer/OEM document.
- `USER-PROVIDED`: provided by the user in the current request but not independently checked.
- `MISSING INFORMATION`: required for the email but unavailable.
- `ASSUMPTION`: low-risk wording assumption, never a technical/commercial claim.

Never invent or imply:

- price, currency, VAT, Incoterm, validity, delivery, lead time, warranty;
- country of manufacture or country of origin;
- certificate availability or inclusion in price;
- OEM authorization, equivalence, compliance, interchangeability, or fit/form/function suitability;
- customer approval, supplier commitment, or final bid readiness.

## Database Lookup

Use `quoteflow-neon` when the email depends on RFQ, customer, supplier, item, quotation, pricing, certificate, origin, status, or workflow-stage facts.

For customer contact lookup, inspect/read `customers` using the live schema. Known useful columns:

- `customer_id`
- `rfq_id`
- `company_id`
- `user_id`
- `company_name`
- `attention_person`
- `carbon_copy_person`
- `email`
- `customer_status`

For supplier contact lookup, inspect/read `supplier_item_status` using the live schema. Known useful columns:

- `id`
- `rfq_id`
- `item_id`
- `supplier_id`
- `supplier_name`
- `contact_email`
- `contact_phone`
- `status`
- `bidder_description`
- `manufacturer`
- `source_url`
- `bidder_unit_price`
- `currency_code`
- `delivery_time`
- `available_qty`
- `compliance_deviation`
- `item_origin`
- `requires_quote`
- `notes`
- `evidence`

Also use related QuoteFlow tables when needed, especially `rfq_analysis`, `rfq_items`, `quotations`, and `quotation_pricing`. Always scope reads by `company_id = 1` and `user_id = 1` when those columns exist unless the user supplies different context or live data proves otherwise.

If no valid recipient email is found in QuoteFlow or Gmail context, do not guess. Ask the user for the recipient or provide the draft without a recipient.

## Email Persistence

Use `quoteflow-neon` to keep RFQ email history durable:

- For incoming customer/supplier/OEM/manufacturer/distributor replies used as workflow evidence, confirm the message is already persisted in `incoming_emails` with the correct `rfq_id`. If not, route to `bid-package-orchestrator` or `rfq-analysis` persistence before using the reply for stage decisions.
- After an approved Gmail send or reply succeeds, store the outgoing record in `email_table` when `rfq_id` or `quotation_id` is clear and the live schema supports it.
- Also write `rfq_email_events` for incoming and outgoing RFQ email events when that table exists, including direction, party type/name, Gmail thread/message ids, subject, summary, event time, and source payload where columns exist.
- Do not claim an RFQ email was sent, stored, or scheduled as part of the QuoteFlow record unless the relevant database write or explicit blocker is reported.

## Gmail Use

Use `gmail:gmail` when the user asks to:

- find or read a customer/supplier email thread;
- reply in an existing thread;
- preserve the original subject line or recipients;
- create a Gmail draft after user approval;
- send, forward, label, archive, or otherwise change Gmail state.

Do not perform Gmail send, draft, forward, archive, trash, label, or move actions until the user explicitly approves the exact draft and recipients.

If the email is a reply, read the relevant Gmail thread first where available and preserve thread context, sender, subject, latest decision, and open questions.

## Post-Email Watch Registration

After an approved Gmail send or reply is successfully completed for an RFQ workflow, immediately use `scheduled-task` to create or update an active hourly `rfq_watch` unless the user explicitly says not to monitor.

Use `quoteflow-neon` through `scheduled-task` for all database persistence. Do not write scheduling rows directly from this skill.

Register one parent watch task per RFQ whenever possible, then add the sent/replied Gmail thread as a watch target. Use duplicate checks so repeated emails for the same RFQ/thread update the existing watch instead of creating duplicate tasks.

The watch instruction must tell the future ChatGPT Scheduled Task or dispatcher to check for new customer/supplier replies, summarize meaningful changes, suggest the next action, and notify the user through ChatGPT/mobile/email according to the user's ChatGPT notification settings. Do not promise direct SMS or phone-number notification unless a separate notification integration exists.

Only register a watch when the RFQ context and Gmail thread/message checkpoint are clear. If the thread id, RFQ identity, or recipient party type cannot be resolved safely, report the missing watch-registration information instead of inventing it.

## Other Proactive Scheduling

While drafting or sending procurement emails, identify other schedule-worthy tasks such as supplier quote follow-ups, promised customer reply dates, quotation validity expiry, shipment confirmation checks, document/certificate response watches, or internal approval reminders.

Do not create those proactive tasks automatically. Ask the user for explicit approval before calling `scheduled-task`, except for the mandatory post-email RFQ reply watch above.

The approval request must be 20-30 words maximum and include the task description, purpose, and reason it should be created. Use this style:

```text
I'll schedule [task] to [purpose], because [reason]. Should I set this up?
```

Wait for an explicit yes or equivalent approval before scheduling. Do not treat draft approval, send approval, silence, or a general acknowledgement as approval for a separate proactive task.

## Composition Workflow

1. Identify email purpose, audience, language, urgency, and whether it is a new email or thread reply.
2. Determine whether the email needs database or Gmail facts.
3. If facts are needed, use `quoteflow-neon` for QuoteFlow data and `gmail:gmail` for mailbox/thread data.
4. Build a concise fact packet:
   - RFQ/RFP/ITT reference;
   - customer/supplier name;
   - item IDs, descriptions, qty, UOM;
   - manufacturer, model, P/N;
   - quotation number/date, currency, lead time, validity;
   - certificate/origin/deviation status;
   - blockers or required clarifications.
5. Draft the email in a professional, polite, direct tone.
6. Show the draft in chat first with:
   - `To`
   - `CC`
   - `Subject`
   - `Body`
   - `Facts used`
   - `Missing/needs confirmation`
7. Ask the user to approve, edit, or provide missing information.
8. Only after approval, use `gmail:gmail` to create a Gmail draft or send, exactly as approved.
9. If the approved Gmail send/reply succeeds and the email belongs to an RFQ/customer/supplier workflow, persist the outgoing email record through `quoteflow-neon`, then call `scheduled-task` to create or update the post-email `rfq_watch` with the Gmail thread checkpoint and notification instruction. If only a Gmail draft is created, schedule monitoring only when the user explicitly asks to watch that thread before sending.
10. If the email content reveals another useful follow-up, deadline, approval reminder, or condition watch, ask the 20-30 word approval question before calling `scheduled-task` for that separate task.

## Tone Rules

- Use clear, respectful business English by default.
- Keep supplier RFQs concise and specific; include exact item references and requested quote fields.
- Keep customer emails confident but avoid unsupported guarantees.
- Use soft but direct wording for follow-ups.
- Use precise wording for deviations: disclose confirmed differences without overstating non-compliance.
- Use neutral wording for missing information: ask for confirmation instead of implying fault.
- Avoid aggressive urgency unless the deadline requires it.

## Standard Requested Quote Fields

For supplier RFQs, request only relevant fields, commonly:

- exact offered manufacturer;
- exact model and P/N;
- technical datasheet;
- unit price and currency;
- quantity and UOM;
- lead time;
- quotation validity;
- Incoterm;
- warranty;
- country of manufacture/country of origin;
- certificate availability and whether included in price;
- deviations or alternatives;
- export availability.

For legacy or unclear models, include:

```text
If the referenced model or ordering code is no longer current, please propose the current OEM configuration and clearly identify any technical or configuration differences.
```

## Output Rules

Always present the draft in chat before Gmail action.

Use this format:

```markdown
To:
CC:
Subject:

Body:
...

Facts used:
- ...

Missing / needs confirmation:
- ...
```

If no facts are missing, write `Missing / needs confirmation: None identified from the available sources.`

## Failure Rules

- Do not send any email without explicit user approval after showing the draft.
- Do not create a Gmail draft unless the user asks or approves it.
- Do not claim reply monitoring was scheduled unless `scheduled-task` confirms database persistence.
- Do not claim an outgoing RFQ email was stored unless `email_table` or `rfq_email_events` persistence succeeds or a blocker is reported.
- Do not create proactive follow-up, reminder, deadline, or condition-watch tasks unless the user explicitly approves the separate 20-30 word scheduling request.
- Do not use database values without source context when multiple RFQs, customers, or suppliers match.
- Do not expose supplier purchase cost, internal margin, internal analysis, or non-customer-facing procurement notes.
- Do not use `supplier_item_status.bidder_unit_price` in customer-facing emails unless the workflow confirms it is approved for external use.
- Do not claim certificate, origin, lead time, compliance, or price validity unless verified.
- If facts conflict between database, Gmail, supplier quote, and customer RFQ, preserve the conflict and ask for resolution before sending.

