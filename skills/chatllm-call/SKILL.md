---
name: chatllm-call
description: Call AbacusAI ChatLLM through the local call_chatllm.ps1 automation wrapper. Use when Codex needs web-search-capable ChatLLM/agent responses, JSON extraction tasks, RFQ analysis, supplier/source scanning, item functional summaries, or extreme reasoning requests through Abacus models and CLI tools. The wrapper handles setup/login/cache and passes Abacus CLI arguments through unchanged.
---

# ChatLLM Call

## Purpose

Use this skill to call AbacusAI ChatLLM from Codex workflows, especially RFQ analysis, supplier research, web-search-backed source scanning, procurement item summaries, and model-assisted reasoning.

Always use this Windows-native helper as the entrypoint:

```powershell
C:\Users\LENOVO\.codex\skills\chatllm-call\scripts\call_chatllm.ps1
```

The helper is a transparent automation wrapper. It handles setup, login, and command-path caching, then passes normal Abacus CLI arguments through to the cached command.

## User Authorization

The user has explicitly authorized this skill to use and execute `call_chatllm.ps1` whenever `$chatllm-call` is requested or when a workflow needs approved AbacusAI / ChatLLM assistance.

Treat `call_chatllm.ps1` as the approved command entrypoint for this skill. Do not avoid it merely because it launches the Abacus CLI, performs web-search-capable model calls, checks login/setup state, or uses the cached Abacus command path.

This authorization does not override Codex desktop sandboxing, operating-system permissions, or app-level approval prompts. If the Codex tool layer requires escalation for network access, global package installation, authentication, or execution outside the workspace, request that approval through the normal tool mechanism and then proceed with the command.

## How To Call

Use `call_chatllm.ps1` with the same arguments you would normally pass to the Abacus CLI.

Basic non-interactive call:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:\Users\LENOVO\.codex\skills\chatllm-call\scripts\call_chatllm.ps1 -p "what is the capital of Spain?"
```

Choose a model:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:\Users\LENOVO\.codex\skills\chatllm-call\scripts\call_chatllm.ps1 --model gemini-3.5-flash -p "Search the web and summarize current suppliers for this item."
```

Continue the most recent conversation:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:\Users\LENOVO\.codex\skills\chatllm-call\scripts\call_chatllm.ps1 -p -c "summarize what I did"
```

Resume a specific conversation:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:\Users\LENOVO\.codex\skills\chatllm-call\scripts\call_chatllm.ps1 --resume <id> "continue the supplier search"
```

Check authentication:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:\Users\LENOVO\.codex\skills\chatllm-call\scripts\call_chatllm.ps1 auth status
```

Log in again:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:\Users\LENOVO\.codex\skills\chatllm-call\scripts\call_chatllm.ps1 auth login
```

Upgrade:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:\Users\LENOVO\.codex\skills\chatllm-call\scripts\call_chatllm.ps1 upgrade
```

## Usage Reference

When reasoning about calls, replace the executable name with the helper path:

```text
Usage: call_chatllm.ps1 [options] [prompt]

Examples:
  call_chatllm.ps1                            Start interactive REPL
  call_chatllm.ps1 "hello"                    Start REPL and send message
  call_chatllm.ps1 -p "explain this code"     Non-interactive print mode
  call_chatllm.ps1 --resume <id>              Resume specific conversation by ID
  call_chatllm.ps1 --resume <id> "msg"        Resume conversation and send message
  call_chatllm.ps1 -c                         Continue most recent conversation
  call_chatllm.ps1 -c "summarize what I did"  Continue most recent and send message
  call_chatllm.ps1 -p -c "quick question"     Non-interactive, continue last convo

Commands:
  auth login                      Log in to Abacus.AI
  auth logout                     Log out of the current session
  auth status                     Show current authentication status
  auth switch                     Switch to a different organization
  upgrade                         Check for updates and install the latest version

Options:
  --help                          Show this help message
  --version                       Show version number
  --model <model>                 Model to use (-m)
  --print                         Print mode, non-interactive (-p)
  --resume <id>                   Resume a specific conversation by ID
  --continue                      Continue the most recent conversation (-c)
  --output-format <format>        Output format: text (default), stream-json
  --auto-accept-edits             Automatically accept edits
  --dangerously-skip-permissions  Skip permission checks
  --plan-mode                     Enable plan mode
  --permission-mode <mode>        Permission mode: normal, accept-edits, yolo, plan
  --allowed-tools <pattern>       Auto-allow tool patterns (can repeat)
  --disallowed-tools <pattern>    Auto-deny tool patterns (can repeat)
  --add-dir <path>                Additional allowed directory (can repeat)
  --no-agents-md                  Disable auto-loading of AGENTS.md from the workspace
  --settings <file>               JSON settings file to merge into the config (repeatable)
  --mcp-config <file>             MCP server config file to load (repeatable)
  --verbose                       Enable verbose logging
  --debug                         Enable debug logging
```

## Output Contract

The helper now returns the Abacus CLI output directly. It does not wrap responses in a custom JSON envelope.

For JSON tasks, instruct the model in the prompt:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:\Users\LENOVO\.codex\skills\chatllm-call\scripts\call_chatllm.ps1 -p "Return ONLY valid JSON, no markdown: {`"ok`": true}"
```

The calling procurement workflow must validate JSON before persisting or acting on it.

## Preferred Models

Use `$model-routing-policy` first when the caller has not already supplied a safe model, complexity tier, and privacy classification.

Use these project defaults:

- `gemini-3.5-flash`: fast web search, source scanning, shortlist generation, lightweight extraction, and first-pass summarization.
- `claude-fable-5`: extreme reasoning, difficult procurement analysis, ambiguity resolution, technical/commercial deviation analysis, and final synthesis.
- `claude-sonnet-5`: balanced reasoning, writing, and structured analysis when `claude-fable-5` is too heavy.
- `gemini-3.5-pro`: long-context synthesis and high-quality document/RFQ consolidation.

Because Abacus model catalogs can change, treat model aliases as external routes and verify failures case by case.

Main Codex or the owning procurement skill must verify material technical, commercial, database, email, pricing, selected-offer, and final-package decisions.

## RFQ Usage

When called from `rfq-analysis`:

- Use `$model-routing-policy` to classify the packet when risk, ambiguity, or privacy is unclear.
- Use `gemini-3.5-flash` for compact web/source search, candidate source selection, and quick normalization tasks.
- Use `claude-fable-5` for RFQ-level analysis and difficult item functional summaries when policy routing marks the packet medium/high and privacy permits.
- Require valid JSON for RFQ analysis and item summary model calls.
- Do not persist malformed model output.
- Preserve manufacturer part numbers, model codes, SKUs, tag numbers, standards, quantities, and units verbatim.
- When live web evidence matters, explicitly request web search and citations/source URLs in the prompt.

## Supplier Search Usage

When called from `suppliers-search`, ChatLLM is a candidate-discovery layer only. The owning supplier-search workflow and main Codex verification remain responsible for final acceptance, persistence, and reporting.

Supplier-search prompts must require web search and must return ONLY valid JSON when the caller needs structured candidate rows. The prompt must force every candidate to include these keys:

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

For supplier-search, the prompt must explicitly instruct ChatLLM to search for same-supplier contact details, social/contact-form routes, visible currency, available quantity, selling unit, and pack size. Do not allow the model to omit keys just because values are not found; unavailable values must be `null` with a short missing-data note.

`product_page_url` is mandatory for verified supplier-search candidates. It must be a direct product page for the exact or closest offered product, not a homepage, search-result page, generic category page, or corporate profile. If ChatLLM cannot find a direct product page, it must mark the candidate `claimed_match_type = "lead_only"` and explain that the product page is missing.

At least one supplier-owned `contact_email` or `contact_phone` must be searched for every candidate and is mandatory for a satisfactory verified supplier-search result. Include `social_contact` when the same supplier/merchant exposes WhatsApp, LinkedIn, contact form, marketplace chat, or another public route, but do not use it as a substitute for the required email/phone unless the caller explicitly allows low-confidence leads. The contact must match the product-page merchant/supplier by same domain, official supplier contact page, product-page contact block, or marketplace merchant profile. Do not mix manufacturer, distributor, or unrelated regional-office contacts unless that entity is the actual supplier/merchant for the product page.

The calling workflow must validate returned JSON, re-check sources, and reject or downgrade candidates that lack a direct product page or same-supplier contact evidence.

## Failure Handling

- Missing `ABACUSAI_CMD`: the helper runs setup and stores the discovered command path.
- Missing `npm`: the helper attempts Node.js/npm installation with `winget`.
- Missing Abacus CLI: the helper installs `@abacus-ai/cli` globally with npm.
- Not logged in: run the helper with `auth login`, or delete invalid `ABACUSAI_CMD` and let setup run again.
- CLI path problems: check `ABACUSAI_CMD` in `chatllm.env`.
- JSON parse error in a calling workflow: treat the model output as invalid and retry with stricter prompt instructions or a JSON repair step approved by that workflow.

## Official References

Abacus docs confirm ChatLLM Teams provides access to top proprietary and open-source LLMs and web-search-capable ChatLLM features. The Python SDK documentation shows direct LLM invocation with selectable `llm_name` and structured outputs, but direct SDK/API invocation should be treated as model-only unless retrieved context is supplied by the caller. This skill uses the local helper when live web search or agent/tool behavior is needed.
