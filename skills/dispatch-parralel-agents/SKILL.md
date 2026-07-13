---
name: dispatch-parralel-agents
description: Plan, dispatch, and reconcile parallel Codex worker workflows for multiple independent tasks. Use when the user asks to split work across agents, run tasks in parallel, coordinate multiple workstreams, compare independent approaches, investigate unrelated failures, process multiple files/RFQs/suppliers, or decide whether Codex workers, direct Codex reasoning, parallel tool calls, model-routing-policy, or $chatllm-call should handle each task based on independence, privacy, tool access, cost, and difficulty.
---

# Dispatch Parralel Agents

## Purpose

Use this skill to coordinate several independent workstreams while keeping the main Codex instance responsible for planning, privacy, integration, and final verification. The pattern is adapted from the public `dispatching-parallel-agents` skill: isolate one worker per independent problem domain, give each worker a self-contained packet, then merge and verify results centrally.

This skill does not create a separate "team agents" product. Use whatever execution surface is available in the current Codex session: multi-agent tools when exposed, parallel tool calls for simple reads, independent Codex threads when explicitly requested, or direct main-agent work when parallelism would add overhead.

## Dispatch Gate

Dispatch only when all are true:

- There are at least two independent tasks or evidence streams.
- Each worker can succeed with a focused, self-contained context packet.
- Workers will not compete for the same file, database row, email draft, browser state, or live external side effect.
- The main agent can review every result before finalizing.

Do not dispatch when one fix may change all results, the work needs one coherent judgment, the task is small, or the data is too sensitive to share outside the current trusted context.

## Execution Surface

Choose the lightest surface that can safely complete each packet:

- Use direct main Codex reasoning for small tasks, sequential dependencies, final synthesis, privacy-sensitive content, or decisions where parallel context would fragment judgment.
- Use parallel tool calls for simple independent reads, searches, file inspections, command outputs, or schema checks.
- Use Codex workers/subagents when tasks need local files, tools, repo context, tests, edits, multi-step investigation, or isolated review of different files, systems, suppliers, RFQs, or failure groups.
- Use `$chatllm-call` only for approved text/model tasks that do not need local tool access: summarization, classification, JSON extraction, RFQ/item functional summaries, ambiguity review, or technical/commercial reasoning. Do not send private RFQ, email, database, or customer content to ChatLLM unless the user has authorized that external model call.

For procurement and database work, keep domain skills in charge: use `$rfq-analysis` for RFQ processing, `$quoteflow-neon` for Neon persistence, `$scheduled-task` for scheduled work, and `$chatllm-call` only as a model-assistance layer when those workflows allow it.

When model or worker complexity is not obvious, use `$model-routing-policy` before dispatch. Do not duplicate its full routing table here; apply its privacy gate, complexity tier, and final-verifier rules to every worker or model packet.

## Difficulty Routing

Default to `auto` unless the user specifies a complexity hint. Use `$model-routing-policy` as the canonical source when a procurement workflow needs a model, reasoning, or privacy decision.

- `low`: Use direct Codex with low reasoning or parallel tool calls. For approved ChatLLM text tasks, prefer `gemini-3.5-flash`. Examples: quick source scan, shallow summary, simple classification, low-risk JSON normalization.
- `medium`: Use Codex workers with normal/medium reasoning for file-aware work. For approved ChatLLM tasks, prefer `gemini-3.5-flash` for extraction and `claude-fable-5` when procurement reasoning or ambiguity matters. Examples: ordinary code review, RFQ field extraction, multi-document comparison.
- `high`: Use one or more focused Codex workers with higher reasoning, then reserve main-agent synthesis for conflict resolution. For approved ChatLLM tasks, prefer `claude-fable-5`. Examples: architecture/security review, conflicting procurement evidence, technical deviation analysis, high-impact commercial decisions.
- `auto`: Estimate difficulty from risk, ambiguity, volume, tool needs, and privacy. Escalate only the packets that truly need stronger reasoning.

## Workflow

1. Classify the user request into independent domains, shared dependencies, and required final outputs.
2. Reject or shrink any packet that would touch shared mutable state without coordination.
3. Pick the execution surface and complexity for each packet.
4. Write a self-contained packet for every worker or model call.
5. Dispatch independent packets concurrently when tools support it; otherwise run them in the most efficient safe order and state the fallback.
6. Collect concise results with evidence, changed files, uncertainties, and recommended next actions.
7. Reconcile conflicts, verify the combined result, and produce the final answer from the main agent.

## Worker Packet Template

Use this structure for Codex workers or independent model calls:

```markdown
Role: <specialized role>
Objective: <one focused outcome>
Scope: <files, records, emails, RFQ items, suppliers, or sources to inspect>
Inputs: <minimal self-contained context, exact identifiers, relevant excerpts, paths>
Exclusions: <what not to change or inspect>
Execution surface: <Codex worker | direct Codex | $chatllm-call model>
Complexity: <auto | low | medium | high>
Privacy: <local only | external model authorized | redact before external call>
Output contract: <summary, JSON schema, findings list, patch summary, citations>
Verification: <tests, schema checks, cross-checks, evidence requirements>
```

Keep packets narrow. A good packet names one problem domain and one expected output. Avoid vague prompts such as "analyze everything" or "fix all issues."

## Integration Rules

- The main agent owns final edits, final database writes, final email sends, and final user-facing conclusions unless a worker was explicitly assigned a safe write task.
- Never let two workers edit the same file, migration, database row, draft email, or external resource without a merge plan.
- Treat worker output as evidence, not truth. Review it, check conflicts, and verify important claims.
- Preserve source identifiers: filenames, line numbers, email subjects, dates, RFQ numbers, supplier names, item numbers, database table names, and model names.
- Report unresolved conflicts, missing evidence, unreadable inputs, or privacy limitations instead of smoothing them over.

## Final Response Shape

For substantial parallel work, return:

- `Dispatch summary`: what was split and why.
- `Workstreams`: one line per worker/model/tool packet.
- `Results`: key findings or changes from each stream.
- `Conflicts or gaps`: disagreements, missing data, blocked items.
- `Verification`: checks run by the main agent.
- `Final outcome`: the integrated answer or completed changes.

For small tasks, keep the answer short and only mention parallel dispatch if it materially affected the result.


