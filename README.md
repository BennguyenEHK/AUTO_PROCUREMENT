# AUTO_PROCUREMENT

QuoteFlow / AUTO_PROCUREMENT is a local Codex skill pack for industrial procurement workflows. It helps process RFQs, tender documents, supplier sourcing, quotations, technical compliance, pricing, bid forms, email drafting, scheduled follow-ups, and final bid packaging.

## What Is Included

- `.codex-plugin/plugin.json` - plugin manifest so Codex can install this as a visible skill pack.
- `skills/` - self-generated Codex skills for QuoteFlow procurement work.
- `scripts/install-local-plugin.ps1` - local installer that registers this repo as a personal Codex plugin.
- `AGENTS.md` - short project guidance for Codex inside this repository.
- `scheduled.md` - prompt for the QuoteFlow RFQ Watch Dispatcher scheduled task.

## Skill List

- `bid-forms-generator`: Generates formal tender forms from frozen selected-offer data.
- `bid-package-orchestrator`: Coordinates complete RFQ-to-final-bid package workflow.
- `brainstorm`: Shapes unclear ideas into approved practical designs.
- `certificate-origin-review`: Reviews certificates, origin, and documentation compliance.
- `chatllm-call`: Calls external ChatLLM models for approved model assistance.
- `comercial-pricing`: Calculates and persists QuoteFlow commercial pricing.
- `dispatch-parralel-agents`: Splits independent work across agents or model packets.
- `frontend-design`: Guides polished, intentional frontend visual design.
- `model-routing-policy`: Chooses safest model route by complexity and privacy.
- `procurement-email-composer`: Drafts professional procurement emails with approval gates.
- `quoteflow-neon`: Handles QuoteFlow Neon database inspection and persistence.
- `report-generator`: Creates procurement reports and proposal artifacts.
- `rfq-analysis`: Analyzes Gmail RFQs and persists extracted requirements.
- `rfq-workflow-learner`: Quietly observes workflows and proposes approved improvements.
- `scheduled-task`: Registers reminders, watches, and recurring procurement tasks.
- `selected-offer-manager`: Manages approved final supplier offer dataset.
- `submission-qa-packager`: Performs final QA and packages tender submissions.
- `supplier-quotation-normalizer`: Normalizes supplier quotations into comparable structured data.
- `suppliers-search`: Finds, verifies, reports, and persists supplier matches.
- `technical-compliance-review`: Compares requirements versus offers and classifies deviations.
- `tender-document-intake`: Structures tender files into requirement baselines.

## Recommended Install: Codex Plugin

Install as a plugin so the skills are registered through Codex's plugin/marketplace discovery path and can appear in the skill picker.

```powershell
git clone https://github.com/BennguyenEHK/AUTO_PROCUREMENT.git
cd AUTO_PROCUREMENT

powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\install-local-plugin.ps1
codex plugin add auto-procurement@personal
```

Fully restart Codex and start a new task after installing. The plugin exposes the skills from `skills/`.

## Fallback: Raw Skill Install

If your Codex environment only supports `skill-installer`, you can ask Codex:

```text
Use skill-installer to install the skills from:
https://github.com/BennguyenEHK/AUTO_PROCUREMENT/tree/main/skills
```

Raw skill installs copy folders into `.codex\skills`. If the Codex UI does not show them in `$` or `/`, use the plugin install above instead.

## Required Local Configuration

Some skills depend on connected Codex plugins or local app access:

- Gmail plugin for RFQ emails and procurement replies.
- Neon Postgres plugin for QuoteFlow database work.
- Google Drive, documents, spreadsheets, or PDF tooling when working with source files.
- Optional ChatLLM/AbacusAI configuration for approved external model assistance.

For `chatllm-call`, run the wrapper script instead of committing local machine cache files:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\skills\chatllm-call\scripts\call_chatllm.ps1 --help
```

On first use, `call_chatllm.ps1` checks for npm, installs the Abacus.AI CLI when needed, resolves the local Abacus command path, and generates:

```text
skills\chatllm-call\scripts\chatllm.env
```

The generated file stores the local value:

```text
ABACUSAI_CMD=C:\Users\<user>\AppData\Roaming\npm\abacusai.cmd
```

If `chatllm.env` is missing, or if `ABACUSAI_CMD` points to a path that no longer exists, the wrapper repeats setup and rewrites the file. `chatllm.env` is local machine state and should not be committed.

Do not commit `.env`, `.secrets`, `chatllm.env`, connection strings, API keys, Gmail exports, or private customer/supplier records.

## Notes

- Local artifacts should be returned with Windows-safe paths, such as `C:\...`, and browser-safe HTML links like `file:///C:/...`.
- QuoteFlow live database work should go through the `quoteflow-neon` skill.
- Full RFQ or bid-package workflows should start with `bid-package-orchestrator`.
