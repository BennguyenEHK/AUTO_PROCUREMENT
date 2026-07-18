# AUTO_PROCUREMENT

QuoteFlow is a Codex skills package for industrial procurement: RFQ intake, supplier discovery, quote normalization, technical compliance, certificate/origin review, pricing, proposal review, bid forms, follow-ups, and final bid packaging.

## Included Package

The `skills/` directory contains the complete distributable QuoteFlow package, including the Next.js web app at `skills/quoteflow-webapp` and the `systematic-debugging` skill. Install these skill folders into the customer Codex skills home; do not copy generated build folders, local identity state, or secrets.

## First Run

After installing the package, begin by invoking `$bid-package-orchestrator` or asking Codex to run `setup`.

The setup preflight automatically:

1. Resolves the installed `quoteflow-webapp` package by its `package.json` identity.
2. Finds Node.js and npm with `where.exe`. If either is absent, it installs Node.js LTS through WinGet and verifies the commands again.
3. Runs `npm ci` in the web app.
4. Validates local database configuration without displaying the connection string.
5. Runs `npm run build` and a read-only database ping.
6. Starts the production app at [http://localhost:3000/](http://localhost:3000/).

Do not run `npx create-next-app`: this repository already contains the finished QuoteFlow web app.

If `SIGNUP.json` is absent after setup, open the local app and complete signup. The server action creates the company and user records in the database, then writes the canonical local identity file. Do not manually create `SIGNUP.json`.

## Local Configuration

Create `skills/quoteflow-webapp/.env.local` from `skills/quoteflow-webapp/.env.example` and set `DATABASE_URL` locally. Never commit the resulting `.env.local`, database credentials, `SIGNUP.json`, ChatLLM cache, customer data, `node_modules`, or `.next`.

## Install Shape

Use Codex `skill-installer` to install the skill folders from this repository's `skills/` directory into:

```text
C:\Users\<customer>\.codex\skills
```

Start a new Codex task after installation so its skill registry loads the installed skills. Every `SKILL.md` is UTF-8 without BOM and begins byte-for-byte with YAML frontmatter delimiter `---`.

## Core Skills

- `bid-package-orchestrator`: complete workflow, setup, readiness gates, and sequencing.
- `quoteflow-webapp`: local database-backed signup, reports, pricing, and proposals.
- `quoteflow-neon`: scoped database inspection and persistence.
- `rfq-analysis`, `suppliers-search`, `supplier-quotation-normalizer`, `technical-compliance-review`, and `certificate-origin-review`: the main procurement review stages.
- `comercial-pricing`, `report-generator`, `bid-forms-generator`, and `submission-qa-packager`: customer-facing pricing, reporting, forms, and final package work.
- `systematic-debugging`, `brainstorm`, `model-routing-policy`, and `dispatch-parralel-agents`: design, diagnosis, routing, and delegation support.

## Security

The repository intentionally excludes database URLs, API keys, authentication state, customer files, generated reports, dependency folders, and build output. Keep live database work tenant-scoped through `$quoteflow-neon`.
