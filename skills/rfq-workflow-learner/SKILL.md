---
name: rfq-workflow-learner
description: Observe QuoteFlow RFQ and bid-package workflows in quiet background mode, capture repeatable user decisions, corrections, stage transitions, evidence patterns, and process improvements, then propose approved updates to existing skills or new skill ideas only at natural pause points. Use when Codex is running or assisting RFQ analysis, tender intake, supplier sourcing, quotation normalization, compliance review, pricing, selected-offer approval, bid packaging, procurement emails, scheduled RFQ watches, or any bid-package-orchestrator workflow where the user wants Codex to learn reusable procurement habits without interrupting active work.
---

# RFQ Workflow Learner

## Purpose

Observe RFQ work quietly while another procurement skill does the actual task. Capture patterns that could become reusable workflow guidance, then ask the user for approval before any skill, database schema, AGENTS.md, or workflow-rule change is made.

This is an observer and improvement-proposal skill. It does not replace `bid-package-orchestrator`, stage skills, `quoteflow-neon`, `procurement-email-composer`, `gmail:gmail`, or `skill-creator`.

## Operating Mode

Run in background observation mode by default.

- Do not take over the active procurement task.
- Do not interrupt analysis, sourcing, email drafting, quote comparison, pricing, QA, or submission work unless the user explicitly asks for learning feedback.
- Track observations as structured notes that can be summarized later.
- Use concise progress-safe language if mentioning the learner during active work.
- Never expose private chain-of-thought. Record decisions, evidence, user corrections, and outcomes only.
- Treat the user as the workflow authority. A repeated user correction is stronger evidence than a single model preference.

## What To Observe

Capture only information useful for improving future RFQs:

- RFQ identity: `rfq_id`, customer, email subject, project reference, tender number, or other stable identifier when available.
- Stage context: `current_stage`, `stage_status`, `next_required_action`, blockers, and downstream skill used.
- User intent: what the user asked to do and whether they overrode the database stage.
- Evidence pattern: which documents, emails, tables, supplier quotes, or records were treated as authoritative.
- Decision pattern: how the user categorized items, selected suppliers, handled deviations, priced offers, approved emails, or accepted/rejected exceptions.
- Correction pattern: any user correction to item grouping, supplier choice, technical reasoning, email wording, stage order, or output format.
- Repetition signal: same manual correction, same missing checklist item, same wording preference, or same routing issue occurring across more than one RFQ or multiple times in one RFQ.
- Outcome: whether the action succeeded, was blocked, needed review, or created a follow-up task.

## Persistence

When persistence is needed and an RFQ/database target is clear, use `quoteflow-neon` for all QuoteFlow Neon reads and writes. Do not query or update Neon directly from this skill.

Prefer storing learner history outside `rfq_analysis` so operational RFQ state stays clean. Suggested tables, if the user has approved creating them:

- `workflow_learning_sessions`: one observation session per RFQ or work block.
- `workflow_learning_events`: stage-level observations, user corrections, evidence choices, and outcomes.
- `workflow_improvement_candidates`: proposed skill updates, new skill ideas, status, approval decision, and implementation result.

If those tables do not exist, continue with chat-local observation notes and propose database setup later at a natural pause point. Do not create tables without explicit user approval.

## Natural Pause Points

Offer improvement suggestions only at the right time and place:

- after the user approves or sends a customer/supplier email;
- after a stage completes and the next stage is clear;
- after a blocker is reported and the workflow is waiting for user input or external reply;
- after the final bid package/session summary;
- when the user directly asks what could be improved;
- when the user is clearly between tasks and not waiting for immediate execution.

Do not propose skill changes while the user is reviewing a draft, comparing quotes, making a technical decision, approving pricing, or waiting for a direct answer.

## Proposal Rules

Before proposing an update, verify that the suggestion is based on at least one of:

- a repeated user correction;
- a stage handoff that caused confusion or rework;
- a recurring missing checklist item;
- a repeated email wording or supplier/customer preference;
- a database field or workflow-state gap that caused ambiguity;
- a successful manual pattern that is likely reusable.

Keep the proposal short: 20-50 words maximum. Use this format exactly:

```markdown
During the observation, rfq-workflow-learner noticed we could <proposed update to an existing skill or creation idea>.

- Reason: <short reason>
- Benefit: <short benefit>

Approve this update?
```

If more detail is needed, wait for the user to ask. Do not include a long implementation plan in the proposal.

## Approval Gate

Never implement a learner proposal automatically.

After the user approves:

1. Use `skill-creator` for any new skill or skill update.
2. Use the narrowest relevant existing skill update instead of creating a duplicate workflow skill.
3. Update `bid-package-orchestrator` only when routing, stage sequencing, or cross-skill coordination needs to change.
4. Update `AGENTS.md` only for durable project-wide governance or routing guidance.
5. Use `quoteflow-neon` only when approved changes require database inspection, schema changes, or persisted learner events.
6. Validate edited skills with the skill validation workflow.

If the user rejects or postpones the suggestion, record it as rejected/postponed when persistence is available, then continue normal work.

## Relationship To Other Skills

- `bid-package-orchestrator`: should activate this skill as a background observer during end-to-end RFQ workflows and stage transitions.
- `rfq-analysis`, `tender-document-intake`, `suppliers-search`, `supplier-quotation-normalizer`, `technical-compliance-review`, `certificate-origin-review`, `comercial-pricing`, `selected-offer-manager`, `bid-forms-generator`, and `submission-qa-packager`: provide stage events and outcomes for observation.
- `procurement-email-composer`: provide email wording approvals, customer/supplier preferences, and post-send pause points.
- `scheduled-task`: provide RFQ watch/follow-up events that may reveal recurring next-action patterns.
- `quoteflow-neon`: source of truth for RFQ workflow state and approved learner persistence.
- `skill-creator`: implements approved learner suggestions.

## Output Style

For normal background observation, say little or nothing.

When asked for a learning summary, produce a concise list:

- observed pattern;
- evidence or stage where it occurred;
- proposed skill or workflow improvement;
- whether it needs user approval, database work, or skill-creator.

When making an unsolicited proposal at a natural pause point, use only the required 20-50 word proposal format.

## Safety Rules

- Do not learn from sensitive content unrelated to the procurement workflow.
- Do not store supplier costs, margins, or customer confidential data unless it is necessary and already belongs in QuoteFlow records.
- Do not treat one-off user preferences as permanent rules unless the user confirms them or they repeat.
- Do not modify another skill, `AGENTS.md`, database schema, or automation instruction without approval.
- Do not suggest improvements during urgent execution unless the issue would prevent a mistake in the current deliverable.


