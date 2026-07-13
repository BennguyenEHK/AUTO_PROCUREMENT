# AUTOMATE_PROCUREMENT Guidance

`AUTOMATE_PROCUREMENT` is an industrial procurement workflow project. Its purpose is to turn emails, RFQs, tender files, drawings, datasheets, supplier quotes, and customer communications into traceable procurement decisions and bid-ready outputs.

Use relevant Codex skills first. Do not manually recreate workflows already handled by skills.

For full RFQ or bid-package workflows, start with `bid-package-orchestrator`. For database work, use `quoteflow-neon`. For customer or supplier emails, use `procurement-email-composer`. For reminders, follow-ups, watches, or recurring checks, use `scheduled-task`. For model/delegation choices, use `model-routing-policy`. For quiet workflow learning and improvement proposals, use `rfq-workflow-learner`.

Use Gmail, Drive, PDFs, documents, spreadsheets, and other connectors only when the task needs live or file-specific context. Let the selected skill decide the detailed workflow.

Keep procurement conclusions traceable to customer RFQ, supplier offer, manufacturer data, database records, Gmail threads, or source files. Label assumptions, missing information, conflicts, and technical deviations clearly.

For QuoteFlow database work, treat Neon as the live source of truth and route all inspection or persistence through `quoteflow-neon`. Default company/user context is `company_id = 1` and `user_id = 1` only when the skill confirms it is safe.

Keep this file short. Put detailed routing, stage logic, database rules, email rules, scheduling rules, and workflow execution steps inside the relevant `SKILL.md`.
