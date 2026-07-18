import type { ReportReadiness, StageReviewDocumentData, StageReviewRow } from "@/types/documents";

type StageReviewType = StageReviewDocumentData["type"];

const INTERIM_STATUS = /\b(draft|pending|in[ _-]?progress|collecting|candidate|unverified|not[ _-]?started|queued)\b/i;

export function readinessForItems(itemIds: number[], coveredItemIds: number[], requirements: readonly string[]): ReportReadiness {
  if (itemIds.length === 0) return unavailableReadiness(itemIds, requirements, "RFQ item baseline is not available yet.");

  const covered = new Set(uniqueItemIds(coveredItemIds));
  const missingItemIds = itemIds.filter((itemId) => !covered.has(itemId));
  const readyItems = itemIds.length - missingItemIds.length;
  const isReady = missingItemIds.length === 0;
  const blockers = isReady ? [] : [
    `Final evidence is missing for item IDs: ${missingItemIds.join(", ")}.`,
    "Interim rows remain workflow evidence and cannot be rendered as a final report."
  ];

  return {
    state: isReady ? "ready" : "collecting",
    is_ready: isReady,
    total_items: itemIds.length,
    ready_items: readyItems,
    missing_item_ids: missingItemIds,
    message: isReady
      ? `Final report ready: ${readyItems} of ${itemIds.length} items have reportable evidence.`
      : `Final report is waiting for evidence on ${missingItemIds.length} of ${itemIds.length} items. Interim results remain in workflow data.`,
    blockers,
    requirements: [...requirements]
  };
}

export function unavailableReadiness(itemIds: number[], requirements: readonly string[], message: string): ReportReadiness {
  return { state: "unavailable", is_ready: false, total_items: itemIds.length, ready_items: 0, missing_item_ids: itemIds, message, blockers: [message], requirements: [...requirements] };
}

export function isReportableStageRow(row: StageReviewRow, type: StageReviewType): boolean {
  if (row.item_id == null || row.item_id <= 0) return false;
  const conclusion = row.status ?? namedText(row.payload, /(status|result|conclusion|mapping_confidence|approval_status)$/i);
  if (!hasText(conclusion) || INTERIM_STATUS.test(conclusion)) return false;

  if (type === "supplier_quote_normalization") {
    const supplier = row.supplier_name ?? namedText(row.payload, /(supplier|vendor)(_name)?$/i);
    return hasText(supplier) && hasNamedValue(row.payload, /(evidence|source|quote|quotation|reference|attachment|mapping|arithmetic|exception|normaliz)/i);
  }
  if (type === "technical_compliance_review") {
    const evidence = hasNamedValue(row.payload, /(evidence|customer_source|supplier_source|requirement|offered|comparison|matrix|datasheet|drawing|calculation|proof)/i);
    return evidence || (/blocked|insufficient/i.test(conclusion) && hasText(row.summary));
  }
  const evidence = hasNamedValue(row.payload, /(evidence|source|certificate|document|origin|coc|coo|atex|iecex|declaration)/i);
  return evidence || (/blocked|insufficient/i.test(conclusion) && hasText(row.summary));
}

function uniqueItemIds(values: number[]): number[] {
  return [...new Set(values.filter((value) => Number.isInteger(value) && value > 0))].sort((left, right) => left - right);
}

function hasText(value: unknown): value is string { return typeof value === "string" && value.trim().length > 0; }

function namedText(value: unknown, keyPattern: RegExp, depth = 0): string | null {
  if (!value || typeof value !== "object" || depth > 5) return null;
  for (const [key, entry] of Object.entries(value)) {
    if (keyPattern.test(key) && hasText(entry)) return entry;
    const nested = namedText(entry, keyPattern, depth + 1);
    if (nested) return nested;
  }
  return null;
}

function hasNamedValue(value: unknown, keyPattern: RegExp, depth = 0): boolean {
  if (!value || typeof value !== "object" || depth > 5) return false;
  for (const [key, entry] of Object.entries(value)) {
    if (keyPattern.test(key) && isMeaningfulEvidence(entry)) return true;
    if (hasNamedValue(entry, keyPattern, depth + 1)) return true;
  }
  return false;
}

function isMeaningfulEvidence(value: unknown): boolean {
  if (hasText(value)) return value.trim().length >= 4;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.some(isMeaningfulEvidence);
  if (value && typeof value === "object") return Object.values(value).some(isMeaningfulEvidence);
  return false;
}
