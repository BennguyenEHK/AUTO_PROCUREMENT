---
title: ChatLLM Model Routing
description: Model-selection guidance for Abacus CLI calls through call_chatllm.ps1.
---

# ChatLLM Model Routing

Use this reference when choosing an AbacusAI model for QuoteFlow or procurement tasks.

## Primary Project Models

| Model | Purpose |
| --- | --- |
| `gemini-3.5-flash` | Fast search, shortlist generation, source scanning, light extraction, summarization. |
| `claude-fable-5` | Extreme reasoning, difficult RFQ analysis, technical/commercial deviations, final synthesis. |

## Additional Essential Routes

Model availability can vary by Abacus account and subscription. Verify model aliases by trying a low-risk `call_chatllm.ps1 --model <model> -p "hello"` call or by checking the current Abacus CLI/app model list when available.

| Model / LLM name | Purpose | Notes |
| --- | --- | --- |
| `OPENAI_GPT4O` | General structured JSON, balanced analysis, broad compatibility. | Official Abacus Python SDK docs show this as an SDK `llm_name`; verify whether it is accepted by the CLI account before using it in production. |
| `gemini-3.5-pro` | Long-context synthesis, careful RFQ/document consolidation. | Candidate CLI model; verify availability. |
| `claude-sonnet-5` | Balanced reasoning and clear writing when fable is too heavy. | Candidate CLI model; verify availability. |

## Selection Rules

- Use `gemini-3.5-flash` when speed matters more than deep reasoning.
- Use `claude-fable-5` when the answer drives procurement decisions or requires careful source reconciliation.
- Use a verified OpenAI/GPT route for strict JSON extraction if it is more reliable in the current Abacus account.
- Use a verified long-context route when the compact context is still large.
- Always keep model choice traceable in logs or intermediate notes when persistence depends on model output.

## Verification

Try a harmless prompt through the wrapper:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:\Users\LENOVO\.codex\skills\chatllm-call\scripts\call_chatllm.ps1 --model gemini-3.5-flash -p "hello"
```

If the CLI is not logged in or the model is unavailable, report the failure and proceed only with user-confirmed model IDs or a verified fallback.

## Official Doc Notes

- ChatLLM Teams / Abacus AI Super Assistant docs describe access to top proprietary and open-source LLMs: `https://abacus.ai/help/chatllm-ai-super-assistant/introduction`
- Abacus Python SDK docs show selectable LLM invocation via `client.evaluate_prompt(..., llm_name = "OPENAI_GPT4O")` and structured JSON response support: `https://abacus.ai/help/python-sdk/genai/calling-llms`
- The current local workflow uses `call_chatllm.ps1` as an Abacus CLI automation wrapper. Exact model aliases should be verified through the CLI/app account before production routing depends on them.
