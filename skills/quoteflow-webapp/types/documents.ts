export type PreviewType =
  | "rfq_analysis"
  | "supplier_search"
  | "supplier_quote_normalization"
  | "technical_compliance_review"
  | "certificate_origin_review";

export type ReportReadinessState = "ready" | "collecting" | "unavailable";

export interface ReportReadiness {
  state: ReportReadinessState;
  is_ready: boolean;
  total_items: number;
  ready_items: number;
  missing_item_ids: number[];
  message: string;
  blockers: string[];
  requirements: string[];
}

export interface PreviewResponse {
  success: boolean;
  document: DocumentData | null;
  readiness: ReportReadiness;
  interim_rows?: StageReviewRow[];
  error?: string;
}

export interface AgentItemSummary {
  identification?: string[];
  classification?: string[];
  application?: string[];
  purpose?: string[];
  features?: string[];
}

export interface RfqItem {
  item_id: number;
  company_description: string;
  qty: number;
  uom: string;
  agent_item_summary?: AgentItemSummary | null;
}

export interface RfqAnalysisDocumentData {
  type: "rfq_analysis";
  rfq_id: number;
  rfq_reference: string;
  subject: string;
  analysis_content: string;
  status?: string;
  deadline_period?: string | null;
  required_currency?: string | null;
  closing_time?: string | null;
  special_requirements?: unknown;
  required_documents?: unknown;
  clarifications?: unknown;
  rfq_items: RfqItem[];
}

export interface SupplierRow {
  id?: number;
  item_id: number;
  supplier_name: string;
  source_url: string;
  manufacturer?: string | null;
  bidder_description?: string | null;
  bidder_unit_price?: number | null;
  currency_code?: string | null;
  delivery_time?: string | null;
  available_qty?: number | null;
  selling_unit?: string | null;
  pack_size?: number | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  social_contact?: string | null;
  match_reasoning?: string | null;
  compliance_deviation?: string | null;
  notes?: string | null;
  evidence?: string | null;
  status?: string | null;
  category?: "source" | "alternative";
  is_preferred?: boolean;
  is_hidden?: boolean;
}

export interface SupplierSearchDocumentData {
  type: "supplier_search";
  rfq_id: number;
  title: string;
  rows: SupplierRow[];
}

export interface QuotationItem {
  item_id: number;
  company_description: string;
  qty: number;
  uom: string;
  supplier_status_id?: number | null;
  supplier_name?: string | null;
  supplier_status?: string | null;
  supplier_candidate_count?: number;
  supplier_basis_warning?: string | null;
  selected_supplier_status_id?: number | null;
  supplier_candidates?: import("@/types/pricing").SupplierCandidate[];
  bidder_description: string;
  bidder_unit_price: number;
  currency_code: string;
  delivery_time?: string | null;
  sales_unit_price?: number;
  ext_price?: number;
  potential_profit?: number;
}

export interface StageReviewRow {
  id?: number | null;
  item_id?: number | null;
  supplier_name?: string | null;
  status?: string | null;
  summary?: string | null;
  payload: Record<string, unknown>;
}

export interface StageReviewDocumentData {
  type: "supplier_quote_normalization" | "technical_compliance_review" | "certificate_origin_review";
  rfq_id: number;
  title: string;
  subtitle: string;
  rows: StageReviewRow[];
}

export type DocumentData =
  | RfqAnalysisDocumentData
  | SupplierSearchDocumentData
  | StageReviewDocumentData;
