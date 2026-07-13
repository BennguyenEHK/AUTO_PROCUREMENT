# RFQ Analysis Output Contract

Use this reference when validating model output or rendering the final report.

## Abacus RFQ JSON

Required shape:

```json
{
  "rfq_analysis": {
    "subject": "RFQ Analysis - topic",
    "analysis_content": "Summary and requirements",
    "analysis_status": "completed"
  },
  "customer_partial": {
    "company_name": "",
    "customer_address": ""
  }
}
```

Reject or repair/retry if:

- JSON is malformed.
- `rfq_analysis` is missing.
- `analysis_status` is not `completed`.
- `customer_partial` is missing.

Do not fabricate missing fields. Use empty strings for unknown customer name/address only when supported by the prompt.

## Item Summary JSON

Required shape:

```json
{
  "items": [
    {
      "item_id": 1,
      "identification": [],
      "classification": [],
      "application": [],
      "purpose": [],
      "features": []
    }
  ]
}
```

Validate:

- One output item for every input item.
- Each input `item_id` appears exactly once.
- No extra fields are needed for the final report.
- Manufacturer part numbers, model codes, SKUs, stock numbers, and product codes remain verbatim.

## Final Report Rules

Use only source-supported facts. Keep concise.

```text
RFQ ANALYSIS - <RFQ reference or concise title>

Deadline
<precise deadline finding>

RFQ Requirement
<2-5 sentence concise summary>

Special / Further Requirements
<concise special requirements, or "No additional special requirements identified">

Extracted Items

| Item | Qty | Unit | Item Identification | Purpose / Application | Key Features |
|------|-----|------|---------------------|-----------------------|--------------|
| 1 | ... | ... | ... | ... | ... |

Clarification Required
<only if needed>
```

Never include raw Gmail JSON, raw model JSON, internal IDs, database queries, full parsed attachment text, attachment hashes, or debug logs.
