# Repository Guidelines

## Project Structure & Module Organization

This repository distributes the QuoteFlow procurement skill package. Customer installations place the contained skill folders under `C:\Users\<customer>\.codex\skills\`. RFQ outputs, supplier-search reports, pricing canvases, and proposal previews must remain RFQ-scoped and must not be committed as customer data.

The local QuoteFlow web app lives at `C:\Users\<customer>\.codex\skills\quoteflow-webapp`. Use it for signup, live database-backed report previews, pricing canvases, print views, and direct quotation persistence when the relevant skill routes to the web app.

## Build, Test, and Development Commands

There is no single package build for this artifact workspace. Use PowerShell to inspect outputs, for example `Get-ChildItem -Recurse -File`. When a skill provides a script, run that script directly, such as `powershell -NoProfile -ExecutionPolicy Bypass -File <script.ps1>`. For full RFQ or bid-package flows, start with `bid-package-orchestrator`.

For first use, invoke `bid-package-orchestrator` or ask for `setup`. Its setup preflight resolves the web app, installs missing Node.js/npm when possible, runs `npm ci`, builds the app, verifies the database connection, and starts `http://localhost:3000/`. Do not use the retired signup helper or a standalone signup page.

## Coding Style & Naming Conventions

Use RFQ-scoped names for generated artifacts, for example `supplier-response-impact-PRD-25-PR-10337.html`. Keep Markdown and JSON readable and avoid raw database dumps in user-facing reports. When editing `SKILL.md`, `AGENTS.md`, Markdown, JSON, or control files, write UTF-8 without BOM and verify no BOM after edits when practical.

## Testing Guidelines

Before returning a report or document preview, verify the target file exists and is non-empty. For JSON, confirm it parses. For HTML reports, confirm the title and key sections match the report type, then provide a Windows absolute path plus a browser-safe `file:///D:/...` or `file:///C:/...` link. Do not return placeholder, relative, stale, `/mnt/...`, or `C:/mnt/...` links.

## Commit & Pull Request Guidelines

Keep commits focused on one workflow fix or document update. Use direct commit messages such as `Update supplier search persistence rules`. Pull requests should describe the RFQ/workflow impact, list changed skills or scripts, include validation performed, and attach screenshots or report paths when UI/report output changed.

## Agent-Specific Instructions

For QuoteFlow database work, treat Neon as the live source of truth and route all inspection or persistence through `quoteflow-neon`. For customer or supplier emails, use `procurement-email-composer`; for reminders, follow-ups, watches, or recurring checks, use `scheduled-task`; for model/delegation choices, use `model-routing-policy`. Keep procurement conclusions traceable to customer RFQs, supplier offers, manufacturer data, database records, Gmail threads, or source files.

RFQ lifecycle rules for separate tasks, cleanup manifests, final cleanup receipts, and local artifact deletion are owned by `bid-package-orchestrator`; follow that skill rather than ad hoc cleanup or mixed-RFQ handling.

For repeated deterministic QuoteFlow database commands, use `npm run db -- <command>` from `C:\Users\<customer>\.codex\skills\quoteflow-webapp` only through `quoteflow-neon` rules. Keep real database URLs in local environment files, never in committed files or reports. For model selection, follow `model-routing-policy`; the orchestrator should use light routing by default and escalate only risky stages.
