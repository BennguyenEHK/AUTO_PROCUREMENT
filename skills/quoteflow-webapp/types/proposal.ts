export type ProposalMode = "technical" | "commercial";

export type ProposalColumnGroup = "company" | "bidder";

export type ProposalCoreColumnId =
  | "item_no"
  | "company_description"
  | "uom"
  | "qty"
  | "bidder_description"
  | "sales_unit_price"
  | "ext_price"
  | "delivery_time";

export interface ProposalCustomColumn {
  id: string;
  label: string;
  group: ProposalColumnGroup;
  mode: ProposalMode;
}

export interface ProposalManualRow {
  id: string;
  mode: ProposalMode;
  values: Record<string, string>;
}

export interface ProposalLayoutConfig {
  version: 1;
  columns: ProposalCustomColumn[];
  manual_rows: ProposalManualRow[];
  rfq_column_values: Record<string, Record<string, string>>;
}

export interface ProposalParty {
  company_name?: string | null;
  address?: string | null;
  customer_address?: string | null;
  tel?: string | null;
  phone?: string | null;
  fax_number?: string | null;
  attention_person?: string | null;
  carbon_copy_person?: unknown;
}

export interface ProposalItem {
  item_id: number;
  supplier_status_id?: number | null;
  company_requirement: {
    company_description: string;
    uom: string;
    qty: number;
  };
  bidder_proposal: {
    bidder_description: string;
    delivery_time?: string | null;
  };
  sales_unit_price?: number | null;
  ext_price?: number | null;
}

export interface ProposalDocument {
  rfq_id: number;
  quotation_id?: number | null;
  rfq_reference: string;
  quotation_name: string;
  quotation_date: string;
  page_number: string;
  currency: string;
  total_amount: number;
  commercial_terms: string;
  seller_info: ProposalParty;
  customer_info: ProposalParty;
  quotation_items: ProposalItem[];
  proposal_layout?: ProposalLayoutConfig | null;
}

export interface ProposalSaveRow {
  item_id: number;
  supplier_status_id?: number | null;
  company_description: string;
  uom: string;
  qty: number;
  bidder_description: string;
  delivery_time?: string | null;
  sales_unit_price?: number | null;
  ext_price?: number | null;
}

export interface ProposalSaveInput {
  rfq_id: number;
  quotation_id: number | null;
  rows: ProposalSaveRow[];
  total_amount: number;
  commercial_terms: string;
  layout?: ProposalLayoutConfig;
}

export type ProposalSaveResult =
  | { success: true; layout_persisted: boolean; warning?: string }
  | { success: false; error: string };
