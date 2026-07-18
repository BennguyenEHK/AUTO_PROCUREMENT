---
name: model-routing-policy
description: Choose the lightest safe model, reasoning tier, worker surface, or ChatLLM route for QuoteFlow procurement workflows. Use when Codex or another skill needs model-selection guidance for RFQ analysis, tender intake, supplier discovery, quotation normalization, compliance review, pricing support, bid packaging, email drafting, scheduled-task checks, parallel agents, or $chatllm-call delegation while preserving privacy, accuracy, and final human/Codex verification.
---

# Model Routing Policy

## Purpose

Route procurement work to the lightest safe execution surface. This policy reduces unnecessary use of the main high-reasoning Codex session while keeping final procurement decisions traceable and reviewed.

This skill does not force Codex to switch its own active model. Use it as routing guidance for:

- main Codex reasoning effort;
- `dispatch-parralel-agents` worker packets;
- approved `$chatllm-call` model calls;
- when to keep work local instead of sending content to an external model.

## Core Rule

Use the cheapest/lightest route that can safely complete the task, then let the main Codex workflow verify material procurement decisions before persistence, email send, offer selection, pricing approval, or final bid packaging.

Never use a model route to bypass:

- user approval;
- `quoteflow-neon` database guardrails;
- `procurement-email-composer` draft review;
- `scheduled-task` approval rules;
- selected-offer freeze;
- final QA.

## OpenAI GPT Switch Defaults

When the active orchestration surface supports GPT model and reasoning-effort selection, use these defaults to save tokens while preserving procurement accuracy:

| Work type | Recommended model | Reasoning effort |
| --- | --- | --- |
| Routine bid-package orchestration, stage checks, report-link checks | `gpt-5.6-terra` | `low` |
| Scheduled-task checks, cleanup manifests, simple fetch/status summaries | `gpt-5.6-luna` | `low` |
| RFQ analysis, tender intake, supplier quote normalization, ordinary certificate/origin review | `gpt-5.6-terra` | `medium` |
| Supplier-search public/redacted discovery dispatch | `gpt-5.6-luna` or `gpt-5.6-terra` | `low` |
| Technical compliance, selected-offer decisions, pricing risk, final submission QA | `gpt-5.6-sol` | `medium` or `high` |
| Serious unresolved blocker, safety/compliance ambiguity, or high-value final-submission conflict | `gpt-5.6-sol` | `xhigh` only when clearly justified |

Default to `gpt-5.6-terra` with `low` reasoning for the main orchestrator when the workflow is mostly routing, reading, writing, or producing status. Escalate the model or reasoning level only for the specific affected stage, then return to the lighter default.

Do not use `xhigh`, `max`, or pro/deep modes for routine RFQ processing, report generation, scheduled checks, cleanup, or simple database persistence.

## Privacy Gate

Before sending content to `$chatllm-call` or any external model, classify the payload:

- `public_or_redacted`: public supplier/manufacturer search terms, generic product class, anonymized summaries. External model use is usually acceptable.
- `project_confidential`: RFQ text, customer names, prices, supplier quotes, Gmail content, database rows, attachments. Keep local unless the user approved the external model call or the workflow already authorizes it.
- `highly_sensitive`: internal margins, final selling price strategy, credentials, private customer/supplier documents, legal/commercial risk. Keep local and use main Codex or approved local tools only.

If privacy is uncertain, keep the work local or ask for approval.

## Complexity Tiers

Use `low` for routine, reversible, low-risk processing:

- file/source scanning;
- shallow summaries;
- simple classification;
- keyword expansion;
- public supplier discovery search terms;
- email tone polishing without new factual claims;
- non-critical JSON normalization.

Preferred route: direct Codex with low/normal effort, parallel tool calls, or `$chatllm-call` with `gemini-3.5-flash` for approved public/redacted text.

Use `medium` for ordinary procurement analysis with structured evidence:

- RFQ field extraction;
- item functional summaries;
- tender register creation;
- supplier quote extraction;
- supplier candidate comparison before verification;
- ordinary certificate/origin/document checks;
- scheduled-task summaries and next-action suggestions.

Preferred route: focused Codex worker or `$chatllm-call` with `gemini-3.5-flash` for extraction and `claude-sonnet-5` or `claude-fable-5` when ambiguity matters, subject to model availability and privacy approval.

Use `high` for decisions that can affect technical compliance, commercial exposure, or final submission quality:

- conflicting customer/supplier/manufacturer evidence;
- technical deviation classification;
- equivalence or fit/form/function reasoning;
- selected-offer approval;
- pricing risk or margin-sensitive reasoning;
- certificate/origin gaps that affect bid compliance;
- final bid-package QA.

Preferred route: main Codex synthesis and verification, optionally supported by focused workers. Use `$chatllm-call` with `claude-fable-5` only for approved assistance, not final authority.

Use `xhigh` only when a high-impact issue remains unresolved after normal high-tier review, such as major contractual ambiguity, safety/compliance risk, or a final submission blocker.

## Stage Defaults

Use these defaults unless the live task is clearly simpler or riskier:

| Stage or skill | Default tier | Notes |
| --- | --- | --- |
| `rfq-analysis` | medium | Low for cleanup/extraction; high only for ambiguous RFQ requirements. |
| `tender-document-intake` | medium | High for conflicting tender instructions or submission rules. |
| `suppliers-search` | low to medium | Use public/redacted search terms first; main Codex verifies against private RFQ data. |
| `supplier-quotation-normalizer` | medium | High when quote mapping is ambiguous or commercially risky. |
| `technical-compliance-review` | high | Model output is assistance only; final classification stays with Codex/user. |
| `certificate-origin-review` | medium to high | High when certificate/origin status affects compliance. |
| `comercial-pricing` | high | Keep margin-sensitive reasoning local. |
| `selected-offer-manager` | high | Final offer choices require main Codex/user verification. |
| `bid-forms-generator` | medium | High when customer forms expose deviations or legal wording. |
| `submission-qa-packager` | high | Final bid package consistency and exposure checks. |
| `procurement-email-composer` | low to medium | Low for tone; medium/high when factual or deviation-sensitive. |
| `scheduled-task` | low | Medium when summarizing complex RFQ watch changes. |
| `rfq-workflow-learner` | low | Only proposals and pattern summaries; no final workflow changes without approval. |

## Handoff Rules

When another skill needs model help:

1. Choose `local`, `worker`, or `$chatllm-call`.
2. Assign `complexity = low | medium | high | xhigh`.
3. Include privacy classification.
4. Send the smallest sufficient context packet.
5. Require JSON output for extraction or normalization.
6. Validate model output before using it.
7. Preserve source identifiers and confidence.
8. Keep final writes, sends, approvals, pricing, selected offers, and bid submission decisions in the main workflow.

## Output Contract

When asked to choose a route, answer briefly:

```text
Recommended route: <local | worker | chatllm-call>
Complexity: <low | medium | high | xhigh>
Model if external: <model or none>
Privacy: <public_or_redacted | project_confidential | highly_sensitive>
Reason: <one sentence>
Verifier: <main Codex | user | stage skill>
```

Do not expose token calculations unless the user asks.

