export const FINAL_REPORT_READY_EVENT = "final_report_ready" as const;

const FINAL_REPORT_LABELS = {
  supplier_search: "Supplier search report",
  supplier_quote_normalization: "Supplier quote normalization",
  technical_compliance_review: "Technical compliance review",
  certificate_origin_review: "Certificate and origin review"
} as const;

export type FinalReportType = keyof typeof FINAL_REPORT_LABELS;

export interface FinalReportReadyInput {
  rfq_id: number;
  report_type: FinalReportType;
  readiness: {
    state: string;
    is_ready: boolean;
  };
  document_ready: boolean;
  rfq_reference?: string | null;
}

export interface FinalReportNotificationDraft {
  rfq_id: number;
  event_type: typeof FINAL_REPORT_READY_EVENT;
  report_type: FinalReportType;
  title: string;
  message: string;
}

export function buildFinalReportReadyNotification(
  input: FinalReportReadyInput
): FinalReportNotificationDraft | null {
  if (!Number.isSafeInteger(input.rfq_id) || input.rfq_id <= 0) return null;
  if (!isFinalReportType(input.report_type)) return null;
  if (input.readiness.state !== "ready" || input.readiness.is_ready !== true || input.document_ready !== true) {
    return null;
  }

  const rfqReference = input.rfq_reference?.trim() || String(input.rfq_id);
  return {
    rfq_id: input.rfq_id,
    event_type: FINAL_REPORT_READY_EVENT,
    report_type: input.report_type,
    title: "Final report ready",
    message: `${FINAL_REPORT_LABELS[input.report_type]} is ready for RFQ ${rfqReference}.`
  };
}

export function isFinalReportType(value: unknown): value is FinalReportType {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(FINAL_REPORT_LABELS, value);
}
