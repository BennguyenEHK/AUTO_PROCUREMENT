---
name: brainstorm
description: Explore rough ideas and turn them into clear, approved designs before implementation. Use when the user asks to brainstorm, ideate, shape a feature, design a workflow, compare product or technical approaches, clarify requirements, plan a new capability, modify behavior, or create something where purpose, constraints, success criteria, UX, architecture, data flow, professional standards, industry criteria, audience, role, or tradeoffs are not yet settled.
---

# Brainstorm

## Purpose

Use this skill to turn an unclear or early idea into a practical design through conversation. It is inspired by the public `brainstorming` skill pattern: understand context first, ask focused questions, compare approaches, and get approval before implementation.

Brainstorming is not implementation. Do not write production code, create migrations, send emails, update live databases, or scaffold large artifacts until the user has approved the design or explicitly asks to skip the design gate.

## Domain And Role Calibration

At the start of every brainstorming task, identify the working domain from the user's prompt, attached data, current repository, active conversation, selected skills, and project context.

Determine:

- Domain or environment: examples include professional procurement processing, web app development, game design, YouTube/content creation, document production, database workflow, product strategy, education, finance, legal, medical, or personal productivity.
- Professional role to adopt: examples include procurement engineer, technical bid engineer, software architect, frontend product designer, game designer, content strategist, editor, analyst, operations manager, or compliance reviewer.
- Audience and user: who will consume or operate the result.
- Production standard: what "good" means in that domain, such as bid-ready procurement traceability, shippable web UX, playable game loop, retention-focused content outline, clean database workflow, or executive-ready document quality.
- Evidence needs: which project file, database, email, document, source, or external reference should be treated as authoritative.

Use private reasoning to choose the role, quality bar, and criteria. Do not expose chain-of-thought. Share only concise assumptions, rationale, options, and tradeoffs useful to the user.

If later user input changes the domain, audience, evidence, or goal, update the role and criteria instead of staying locked to the first interpretation.

## Professional Criteria And Research

When the domain's current standards, platform rules, technical recommendations, legal/regulatory constraints, market expectations, or production criteria could have changed or are not already known from project sources, use web search before finalizing recommendations.

Prefer authoritative sources:

- official documentation, standards, platform rules, manufacturer/OEM data, customer requirements, or primary research;
- current best-practice references for fast-moving domains such as web frameworks, APIs, social platforms, game engines, compliance rules, and model/tool capabilities;
- verified project sources before broad web search when project data already answers the question.

Use external search especially when:

- the user asks for best practices, latest rules, current trends, recommendations, competitive examples, or professional standards;
- the recommendation affects money, safety, compliance, customer submission, public publishing, or substantial implementation effort;
- the domain is unfamiliar, niche, or likely to change;
- direct quotes, links, or source attribution would improve trust.

If browsing is unavailable, state that the criteria are based on local/project context and general knowledge, and label assumptions clearly.

## Core Flow

1. Explore the current context before proposing solutions. Check relevant files, docs, prior decisions, examples, schemas, or project conventions when available.
2. Calibrate the domain, professional role, audience, production standard, and evidence needs.
3. Identify whether the request is one coherent idea or several independent projects. If it is too broad, help split it into smaller designs and start with the highest-value piece.
4. Research current external criteria when needed by the domain, risk, or user request.
5. Ask one clarifying question at a time. Prefer multiple-choice questions when that makes the decision easier.
6. After enough context, propose 2-3 approaches with tradeoffs. Lead with the recommended option and explain why.
7. Present the design in sections scaled to the complexity: goal, scope, user flow, architecture or workflow, data model, edge cases, risks, testing, and rollout.
8. Ask for approval or changes before moving to implementation or detailed execution planning.
9. If the user approves, transition to the relevant next skill or implementation workflow. If no next skill exists, create a concise implementation plan before editing.

## Question Style

Ask questions that reduce real uncertainty:

- Purpose: what problem should this solve?
- Domain and role: what professional standard should the answer satisfy?
- User or operator: who will use it and how often?
- Success criteria: what should be true when it works?
- Constraints: time, cost, privacy, model/tool limits, database rules, integrations, UI expectations.
- Scope boundaries: what should be included now, later, or never?
- Evidence: which source, file, email, RFQ, schema, standard, competitor, or example should be treated as authoritative?

Do not ask a stack of questions at once unless the user requested a form-style intake. Keep momentum: make reasonable assumptions for low-risk details and label them clearly.

## Approach Comparison

When presenting options, use this shape:

```markdown
Recommended: <option name>
Why: <main reason>
Tradeoff: <main cost or risk>

Alternative: <option name>
Best when: <condition>
Tradeoff: <cost or risk>
```

Prefer simple, reversible designs. Remove features that do not serve the stated goal. If a design affects an existing codebase or workflow, follow existing patterns and include only the refactoring needed for the requested outcome.

## Design Output

For small ideas, a few crisp paragraphs are enough. For larger work, include:

- Calibrated role and standard, when useful.
- Goal and non-goals.
- Users and main workflow.
- Proposed approach and alternatives considered.
- Components or process steps.
- Data inputs, outputs, and persistence.
- Privacy, permissions, and external-service concerns.
- Edge cases and failure handling.
- Verification or acceptance checks.
- Open questions.

When the design is approved and durable documentation is useful, save a spec in the project docs location preferred by the repo or user. If no preference exists, use `docs/specs/YYYY-MM-DD--short-title.md`. Ask before committing unless the user already requested commits.

## Visual Aids

Offer a visual aid only when seeing a diagram, mockup, flow, or side-by-side comparison would genuinely clarify the decision. Do not offer it upfront for every brainstorming session.

If a visual would help, ask in a separate short message whether the user wants a visual companion. If they decline, continue text-only. Use visuals for layout options, process diagrams, architecture maps, or UI comparisons; use text for conceptual choices and requirements.

## Transition Rules

- If the user asks to implement immediately, briefly confirm the core design assumption before editing when risk is meaningful.
- If the user approves the design, move to the relevant execution skill: examples include `$rfq-analysis`, `$quoteflow-neon`, `$scheduled-task`, `$dispatch-parralel-agents`, `$bid-package-orchestrator`, `$procurement-email-composer`, frontend work, documents, spreadsheets, or direct coding.
- If the user wants multiple independent directions explored at once, consider `$dispatch-parralel-agents` after the brainstorming scope is clear.
- Preserve decisions, assumptions, evidence, professional criteria, and open questions so later implementation does not silently drift from the approved design.


