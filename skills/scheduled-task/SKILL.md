---
name: scheduled-task
description: Normalize and register QuoteFlow scheduled work, reminders, recurring jobs, condition watches, and RFQ monitoring tasks. Use when the user or an AI agent asks to schedule, remind, pause, resume, stop, monitor, watch, follow, check periodically, notify on replies, or track customer/supplier/RFQ activity in AUTOMATE_PROCUREMENT. Delegates all Neon database lookup and persistence to the existing local $quoteflow-neon skill.
---

# Scheduled Task

## Purpose

Use this skill as the strict scheduling-registration layer for AUTOMATE_PROCUREMENT / QuoteFlow. It interprets scheduling and monitoring intent, normalizes the task definition, resolves project context, validates the request, delegates database work to `$quoteflow-neon`, and returns a concise registration result.

This skill does not act as the scheduler, does not create ChatGPT Scheduled Tasks, and does not execute future tasks. A separate dispatcher reads due or active task records from Neon.

The user may call this workflow `$scheduled_task`; in Codex skill metadata this skill is named `$scheduled-task` to satisfy skill naming rules.

## Required Delegation

Use the existing local `$quoteflow-neon` skill at `C:\Users\LENOVO\.codex\skills\quoteflow-neon\SKILL.md` for every Neon database operation:

- schema inspection
- company, user, RFQ, and task lookup
- duplicate checks
- inserts, updates, pauses, resumes, completions, and deletes
- record validation and persistence confirmation

Do not create an independent Neon client. Do not store credentials, connection strings, passwords, or database secrets in this skill. Never assume columns exist only because this skill describes a conceptual model; ask `$quoteflow-neon` to verify the live main-branch schema before writing.

## Trigger Intent

Invoke this skill for requests such as:

- schedule this, remind me, run this tomorrow
- check this every morning, every hour, every Monday
- watch this RFQ, monitor customer response, monitor supplier replies
- notify me when the supplier responds, keep checking this
- pause monitoring, resume monitoring, stop watching this RFQ
- add this supplier thread to the watch
- after sending this customer/supplier email, watch the thread for replies

## Approval Policy

There are two scheduling paths:

- `mandatory_post_email_watch`: after an approved Gmail send or reply to a customer or supplier in an RFQ workflow, create or update the hourly `rfq_watch` automatically unless the user explicitly says not to monitor.
- `proactive_identified_task`: when Codex notices any other task that should be scheduled, ask the user for explicit approval before invoking this skill to persist it.

For proactive identified tasks, the approval request must be 20-30 words maximum and include:

- the task description;
- the task purpose;
- the reason it should be created;
- a clear approval question.

Use this approval style:

```text
I'll schedule [task] to [purpose], because [reason]. Should I set this up?
```

Wait for an explicit yes or equivalent approval before creating, updating, or persisting any proactive identified task. Do not treat silence, acknowledgement, or unrelated continuation as approval.

Examples that require approval before scheduling:

- bid submission deadline reminders;
- supplier quote or validity expiry checks;
- customer clarification response reminders;
- supplier quotation follow-ups not tied to a just-sent email;
- drawing, datasheet, certificate, origin, or OEM confirmation watches;
- internal review, pricing approval, selected-offer approval, or QA deadline reminders;
- recurring RFQ inbox checks or daily status summaries.

## Task Modes

Classify every request into one mode:

- `one_time_job`: one future execution, then completed after success.
- `recurring_job`: repeated execution such as hourly, daily, weekly, or monthly.
- `condition_watch`: monitor until a specific condition is met.
- `rfq_watch`: monitor RFQ-related customer, supplier, manufacturer, distributor, or internal activity.

Use conceptual `schedule_type` values such as `once`, `hourly`, `daily`, `weekly`, and `monthly`, then map to the live database schema through `$quoteflow-neon`.

## Context Resolution

Resolve context in this order:

1. Current workflow context already known to the invoking agent.
2. Existing QuoteFlow records through `$quoteflow-neon`.
3. Gmail thread ids or message checkpoints already available in the current workflow.
4. User clarification when multiple safe matches remain.

Do not invent `company_id`, `user_id`, `rfq_id`, Gmail thread ids, message ids, or task ids. Default QuoteFlow context may use `$quoteflow-neon` defaults only when that skill says it is safe.

Default timezone for Nguyen Quang Huy / QuoteFlow procurement workflows is `Asia/Ho_Chi_Minh` unless the user or live profile gives another timezone. Never silently treat a local schedule as UTC.

## Normalization Rules

Convert the user request into a self-contained future instruction. The normalized `task_description` must include:

- purpose
- object or RFQ being monitored
- source app or data source
- action to perform
- meaningful-change or success condition
- output or notification requirement
- safety prohibitions
- completion condition when applicable

Examples:

- "Every morning at 7" -> `schedule_type = daily`, `schedule_expression = daily at 07:00`, `timezone = Asia/Ho_Chi_Minh`.
- "Every Monday at 9 AM" -> `schedule_type = weekly`, `schedule_expression = Monday at 09:00`.
- "Watch until the customer approves the drawings" -> condition or RFQ watch with the approval condition preserved verbatim in the task description.

For monitoring tasks, include restrictions unless explicitly authorized otherwise: do not reply, send, delete, archive, approve, place orders, or modify customer/supplier records. If a reminder or watch produces a follow-up email draft, use `procurement-email-composer` for wording and approval flow before any Gmail draft/send action.

For post-email RFQ watches created after an approved Gmail send/reply, normalize the instruction to check the sent/replied thread every hour, detect new replies or meaningful changes, summarize the next suggested action, and notify the user through ChatGPT/mobile/email according to the user's ChatGPT notification settings. Do not promise direct SMS or phone-number notification unless a separate notification integration exists.

## Conceptual Data Models

Verify actual storage through `$quoteflow-neon` before writing.

Identity-column rule: inspect `scheduled_tasks.id` and `rfq_watch_targets.id` before inserts. If either column is identity/default-backed, omit `id` and let Postgres assign it. Only include an existing `id` when updating a row found by duplicate check. Never invent task or watch-target IDs.

Scheduled task conceptual fields:

- `id`, `company_id`, `user_id`, `rfq_id`
- `task_name`, `task_description`, `task_type`
- `schedule_type`, `schedule_expression`, `timezone`
- `next_run_at`, `last_run_at`, `last_activity_at`
- `status`, `complexity_hint`, `retry_count`, `last_error`
- `created_by`, `created_at`, `updated_at`

RFQ watch target conceptual fields:

- `id`, `company_id`, `user_id`, `rfq_id`, `scheduled_task_id`
- `party_type`, `party_name`, `gmail_thread_id`
- `last_seen_message_id`, `last_seen_message_at`
- `last_checked_at`, `last_activity_at`, `created_at`, `updated_at`

Supported conceptual `party_type` values: `customer`, `supplier`, `manufacturer`, `distributor`, `internal`, `other`.

## Status Rules

Use one parent task status only. Do not create or write `watch_status` fields.

Conceptual task status values:

- `active`: the dispatcher may run/check the task when `next_run_at` is due.
- `paused`: keep the task and targets saved, but skip execution.
- `completed`: the task is finished and should not run again.
- `failed`: the last execution failed and needs review.

Do not use `pending`; a future task is `active` with `next_run_at` in the future. Do not use `running` as the stored lifecycle status; execution locks, logs, or dispatcher-local state may represent a temporary run without changing the main status.

For RFQ watch tasks, the parent `scheduled_tasks.status` controls all linked watch targets. All targets under an `active` task are checked together. Pausing or resuming applies to the parent task. If a future workflow needs per-target pausing, design and migrate an explicit target-level control separately instead of reintroducing ambiguous duplicate status.

Normalize "on watch", "keep watching", "monitor", "follow", and "continue checking" to `status = active` for the parent scheduled task.

Conceptual `complexity_hint` values:

- `auto`
- `low`
- `medium`
- `high`

Use `auto` as the recommended default unless the user or workflow explicitly needs a stronger processing hint. Use `low` for lightweight reminders or simple checks, `medium` for ordinary RFQ/watch analysis, and `high` for complex RFQ, technical, multi-thread, attachment-heavy, or ambiguity-heavy tasks.

## Post-Email RFQ Watch Payload

When called after an approved customer/supplier Gmail action, create or update the watch using these conceptual values, mapped through `$quoteflow-neon` to the live schema:

Parent `scheduled_tasks`:

- `company_id`: resolved QuoteFlow company, default `1` only when `$quoteflow-neon` says safe.
- `user_id`: resolved QuoteFlow user, default `1` only when `$quoteflow-neon` says safe.
- `rfq_id`: canonical RFQ id; do not invent it.
- `task_name`: concise name such as `Watch RFQ [reference] email replies`.
- `task_description`: include RFQ reference, customer/supplier parties, Gmail source, what to check, meaningful-change condition, notification requirement, safety prohibitions, and completion condition.
- `task_type`: `rfq_watch`.
- `schedule_type`: `hourly`.
- `schedule_expression`: `every 1 hour`.
- `timezone`: `Asia/Ho_Chi_Minh` unless user/profile says otherwise.
- `next_run_at`: next hourly check time.
- `last_run_at`: leave null for a new watch.
- `last_activity_at`: sent/replied/draft creation time when known.
- `status`: `active`.
- `complexity_hint`: `auto` by default, `medium` for ordinary RFQ reply monitoring, `high` for multi-thread/attachment-heavy watches.
- `retry_count`: `0` for a new watch.
- `last_error`: null for a new watch.
- `created_by`: `codex` unless live schema or user context requires another value.

Child `rfq_watch_targets`:

- `company_id`, `user_id`, `rfq_id`: same resolved context as the parent task.
- `scheduled_task_id`: id of the reused or newly created parent task.
- `party_type`: `customer`, `supplier`, `manufacturer`, `distributor`, `internal`, or `other`.
- `party_name`: customer/supplier/manufacturer name when known.
- `gmail_thread_id`: sent/replied Gmail thread id.
- `last_seen_message_id`: latest known message id at the moment monitoring begins, preferably the sent/replied message.
- `last_seen_message_at`: latest known message time.
- `last_checked_at`: null for a new target unless the dispatcher already checked it.
- `last_activity_at`: sent/replied/draft creation time when known.

If an equivalent active or paused RFQ watch already exists, reuse it and add only missing watch targets or update checkpoints. Do not create duplicate parent tasks for each email in the same RFQ.

## RFQ Watch Workflow

For RFQ watch requests:

1. Resolve `company_id`, `user_id`, and canonical `rfq_id`.
2. Check for an equivalent active or paused RFQ watch task.
3. Reuse the existing task when equivalent; do not create duplicates.
4. Add missing watch targets when appropriate.
5. Preserve existing `last_seen_message_id` and related checkpoints.
6. Initialize a new Gmail watch target to the latest known message when the user wants future replies only.
7. If the user asks to analyze history and continue watching, first route the historical analysis to the relevant workflow, then establish the checkpoint.

Prefer one RFQ watch task with many watch targets over many separate RFQ watch tasks for the same RFQ.

## Updates

Support updates without duplicating tasks:

- pause task
- resume task
- stop/complete monitoring
- change schedule
- change task description or condition
- add watch target
- remove watch target only when the user explicitly asks to stop watching that specific target

Do not delete task history unless the user explicitly requests deletion and `$quoteflow-neon` confirms the operation is safe.

## Duplicate Prevention

Always ask `$quoteflow-neon` to check for duplicates before inserting. Include tenant and task identity in duplicate checks:

- `company_id`
- `user_id`
- `rfq_id`
- `task_type`
- `schedule_type` or watch condition

For watch targets, also consider:

- `scheduled_task_id` or `rfq_id`
- `gmail_thread_id`
- `party_type`

When equivalent intent exists, update the canonical existing task or add missing watch targets, then report that the existing task was updated.

## Persistence Workflow

1. Interpret the user request.
2. Determine whether it is a `mandatory_post_email_watch`, direct user scheduling request, or `proactive_identified_task`.
3. For `proactive_identified_task`, ask the 20-30 word approval question and stop until explicit approval is received.
4. Build a normalized task payload with conceptual fields.
5. Resolve all known context.
6. Validate required fields for the task mode.
7. Invoke `$quoteflow-neon` to inspect live schema and compatible storage.
8. Invoke `$quoteflow-neon` to perform duplicate checks.
9. Invoke `$quoteflow-neon` to insert or update records on the main QuoteFlow branch.
10. Confirm only after `$quoteflow-neon` reports success.

If schema differs from this specification, do not invent columns or write malformed partial records. Use a compatible structure only when mapping is unambiguous. Otherwise report the schema mismatch clearly.

## Response Format

After successful new registration:

```text
Scheduled task registered.

Task:
[task_name]

Type:
[task_type]

RFQ:
[rfq_id or "Global task"]

Schedule:
[human-readable schedule]

Timezone:
[timezone]

Status:
[active, paused, completed, or failed]


Watch targets:
[count]

Database:
Stored through $quoteflow-neon
```

For existing tasks, start with `Existing scheduled task updated.` Do not claim a new task was created when the workflow reused or updated an existing task. For simple requests, keep the final response shorter while preserving task, schedule, RFQ, and status.

## Failure Handling

If database persistence fails, do not claim the task was scheduled. Return a concise failure reason from `$quoteflow-neon` and enough normalized information for safe retry.

If company, user, RFQ, or Gmail thread resolution fails, do not invent identifiers or attach the task to unrelated records. If a generic global recurring task is safe without `rfq_id`, it may be registered without one.

If an existing task has inconsistent database state, ask `$quoteflow-neon` to retrieve relevant records. Perform only safe and clearly justified repairs; otherwise report the inconsistency.

## Acceptance Checks

Validate future changes against these scenarios:

- "Every morning at 7 AM check Gmail for new customer RFQs and send me a summary." -> global `recurring_job`, `daily`, `07:00`, `Asia/Ho_Chi_Minh`, parent `status = active`, persisted through `$quoteflow-neon`.
- Codex notices an unrequested supplier follow-up should be scheduled -> ask a 20-30 word approval question with task, purpose, and reason before invoking persistence.
- "Watch both the customer and supplier responses for LDVA-INS-022." -> one active `rfq_watch`, canonical RFQ resolved, customer and supplier watch targets, no duplicate task, no target-level `watch_status`.
- "After sending a supplier RFQ email for LDVA-INS-022, monitor replies." -> reuse or create one active hourly `rfq_watch`, add the supplier Gmail thread as a watch target, checkpoint the sent message, and notify through ChatGPT/mobile/email settings when a meaningful reply or next action appears.
- "Also watch the new Ashcroft thread for LDVA-INS-022." -> existing RFQ watch reused, one supplier target added, checkpoints preserved.
- "Tell me when the customer approves the drawings for PRD-26-PO-10381." -> condition or RFQ watch, approval condition preserved, no automatic reply authorization.
- "Pause monitoring LDVA-INS-022." -> existing parent task `status = paused`, no deletion, no duplicate.
- "Resume monitoring LDVA-INS-022." -> paused parent task set back to `status = active`.
- "Monitor LDVA-INS-022 email responses." when an equivalent task exists -> duplicate detected and existing task reused.
- "Watch RFQ ABC-UNKNOWN-999." -> canonical RFQ resolution attempted, no invented `rfq_id`, unresolved RFQ reported when safe registration is impossible.



