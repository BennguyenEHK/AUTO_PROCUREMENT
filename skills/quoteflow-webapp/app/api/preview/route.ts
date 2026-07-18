import { NextResponse } from "next/server";
import { one, query, tableColumns } from "@/lib/db/client";
import {
  isReportableStageRow as isFinalStageRow,
  readinessForItems as buildReadiness,
  unavailableReadiness as unavailablePreviewReadiness
} from "@/lib/services/preview/readiness";
import type {
  DocumentData,
  ReportReadiness,
  StageReviewDocumentData,
  StageReviewRow,
  SupplierRow,
  SupplierSearchDocumentData
} from "@/types/documents";

type ReportBuild<T extends DocumentData> = {
  document: T | null;
  readiness: ReportReadiness;
  interim_rows?: StageReviewRow[];
};

type DataRow = Record<string, unknown>;

const INTERIM_STATUS = /\b(draft|pending|in[ _-]?progress|collecting|candidate|unverified|not[ _-]?started|queued)\b/i;

function numberValue(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") ?? "rfq_analysis";
    const rfqId = Number(searchParams.get("rfqId"));
    if (!Number.isFinite(rfqId) || rfqId <= 0) {
      return NextResponse.json({ success: false, error: "rfqId is required." }, { status: 400 });
    }

    let result: ReportBuild<DocumentData>;
    if (type === "supplier_search") result = await supplierDocument(rfqId);
    else if (type === "supplier_quote_normalization") result = await stageReviewDocument(rfqId, "supplier_quote_normalization");
    else if (type === "technical_compliance_review") result = await stageReviewDocument(rfqId, "technical_compliance_review");
    else if (type === "certificate_origin_review") result = await stageReviewDocument(rfqId, "certificate_origin_review");
    else result = await rfqDocument(rfqId);

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to build preview." },
      { status: 500 }
    );
  }
}

const stageConfig = {
  supplier_quote_normalization: {
    table: "supplier_quote_normalizations",
    title: "Supplier Quote Normalization",
    subtitle: "Normalized supplier quotation rows and commercial exceptions.",
    requirements: [
      "Every RFQ item has a mapped supplier quotation conclusion.",
      "Each included row identifies the supplier and contains quote, mapping, or arithmetic evidence.",
      "Draft and in-progress rows remain excluded from the final report."
    ]
  },
  technical_compliance_review: {
    table: "technical_compliance_reviews",
    title: "Technical Compliance Review",
    subtitle: "Technical compliance status, deviations, and fit-for-purpose notes.",
    requirements: [
      "Every RFQ item has a final compliance or documented insufficient-evidence conclusion.",
      "Each included row contains requirement-versus-offer or source evidence.",
      "Draft and in-progress rows remain excluded from the final report."
    ]
  },
  certificate_origin_review: {
    table: "certificate_origin_reviews",
    title: "Certificate / Origin Review",
    subtitle: "Certificate, documentation, and country-of-origin review status.",
    requirements: [
      "Every RFQ item has a final certificate, document, or origin conclusion.",
      "Each included row contains source evidence or a documented evidence gap.",
      "Draft and in-progress rows remain excluded from the final report."
    ]
  }
} as const;

async function rfqDocument(rfqId: number): Promise<ReportBuild<DocumentData>> {
  const rfq = await one("select * from rfq_analysis where rfq_id = $1", [rfqId]);
  if (!rfq) throw new Error("RFQ not found.");
  const items = await query("select * from rfq_items where rfq_id = $1 order by item_id", [rfqId]);
  const document: DocumentData = {
    type: "rfq_analysis",
    rfq_id: rfqId,
    rfq_reference: String(rfq.rfq_reference ?? ""),
    subject: String(rfq.subject ?? rfq.rfq_reference ?? "RFQ analysis"),
    analysis_content: String(rfq.analysis_content ?? ""),
    status: String(rfq.analysis_status ?? ""),
    deadline_period: rfq.deadline_period as string | null,
    required_currency: rfq.required_currency as string | null,
    closing_time: rfq.closing_time as string | null,
    special_requirements: rfq.special_requirements,
    required_documents: rfq.required_documents,
    clarifications: rfq.clarifications,
    rfq_items: items.map((item) => ({
      item_id: numberValue(item.item_id),
      company_description: String(item.company_description ?? ""),
      qty: numberValue(item.qty),
      uom: String(item.uom ?? ""),
      agent_item_summary: item.agent_item_summary as any
    }))
  };
  return {
    document,
    readiness: {
      state: "ready",
      is_ready: true,
      total_items: items.length,
      ready_items: items.length,
      missing_item_ids: [],
      message: "RFQ analysis is available for user validation.",
      blockers: [],
      requirements: []
    }
  };
}

async function supplierDocument(rfqId: number): Promise<ReportBuild<SupplierSearchDocumentData>> {
  const itemIds = await rfqItemIds(rfqId);
  const rows = await query("select * from supplier_item_status where rfq_id = $1 order by item_id, id", [rfqId]);
  const reportRows = rows.map(mapSupplierRow).filter(isReportableSupplierRow);
  const readiness = buildReadiness(
    itemIds,
    reportRows.map((row) => row.item_id),
    [
      "Every RFQ item has at least one active verified supplier source.",
      "Each included source has a supplier name, direct HTTP(S) product URL, and evidence or match reasoning.",
      "Draft, candidate, hidden, and unverified rows remain excluded from the final report."
    ]
  );
  const document: SupplierSearchDocumentData = {
    type: "supplier_search",
    rfq_id: rfqId,
    title: `Supplier search for RFQ ${rfqId}`,
    rows: reportRows
  };
  return { document: readiness.is_ready ? document : null, readiness };
}

async function stageReviewDocument(
  rfqId: number,
  type: keyof typeof stageConfig
): Promise<ReportBuild<StageReviewDocumentData>> {
  const config = stageConfig[type];
  const itemIds = await rfqItemIds(rfqId);
  const columns = await tableColumns(config.table);
  if (!columns.has("rfq_id")) {
    return {
      document: null,
      readiness: unavailablePreviewReadiness(itemIds, config.requirements, `${config.title} data is not available yet.`)
    };
  }

  const orderParts = [];
  if (columns.has("item_id")) orderParts.push("item_id");
  if (columns.has("updated_at")) orderParts.push("updated_at desc");
  else if (columns.has("created_at")) orderParts.push("created_at desc");
  if (columns.has("id")) orderParts.push("id desc");
  const orderBy = orderParts.length ? ` order by ${orderParts.join(", ")}` : "";
  const rows = await query(`select * from "${config.table}" where rfq_id = $1${orderBy}`, [rfqId]);

  const reportRows = rows.map((row) => ({
    id: row.id == null ? null : numberValue(row.id),
    item_id: row.item_id == null ? null : numberValue(row.item_id),
    supplier_name: textFrom(row, ["supplier_name", "supplier", "vendor_name"]),
    status: textFrom(row, ["status", "review_status", "compliance_status", "certificate_status", "approval_status"]),
    summary: textFrom(row, [
      "summary",
      "review_summary",
      "normalization_summary",
      "compliance_summary",
      "certificate_summary",
      "deviation_summary",
      "notes"
    ]),
    payload: row
  } satisfies StageReviewRow)).filter((row) => isFinalStageRow(row, type));
  const readiness = buildReadiness(
    itemIds,
    reportRows.flatMap((row) => row.item_id == null ? [] : [row.item_id]),
    config.requirements
  );
  const document: StageReviewDocumentData = {
    type,
    rfq_id: rfqId,
    title: config.title,
    subtitle: config.subtitle,
    rows: reportRows
  };
  return { document: readiness.is_ready ? document : null, readiness, interim_rows: readiness.is_ready ? undefined : reportRows };
}

async function rfqItemIds(rfqId: number): Promise<number[]> {
  const rows = await query("select item_id from rfq_items where rfq_id = $1 order by item_id", [rfqId]);
  return uniqueItemIds(rows.map((row) => numberValue(row.item_id)));
}

function mapSupplierRow(row: DataRow): SupplierRow {
  return {
    id: numberValue(row.id),
    item_id: numberValue(row.item_id),
    supplier_name: String(row.supplier_name ?? ""),
    source_url: String(row.source_url ?? ""),
    manufacturer: row.manufacturer as string | null,
    bidder_description: row.bidder_description as string | null,
    bidder_unit_price: row.bidder_unit_price == null ? null : numberValue(row.bidder_unit_price),
    currency_code: row.currency_code as string | null,
    delivery_time: row.delivery_time as string | null,
    available_qty: row.available_qty == null ? null : numberValue(row.available_qty),
    selling_unit: row.selling_unit as string | null,
    pack_size: row.pack_size == null ? null : numberValue(row.pack_size),
    contact_email: row.contact_email as string | null,
    contact_phone: row.contact_phone as string | null,
    social_contact: row.social_contact as string | null,
    match_reasoning: row.match_reasoning as string | null,
    compliance_deviation: row.compliance_deviation as string | null,
    notes: row.notes as string | null,
    evidence: row.evidence as string | null,
    status: row.status as string | null,
    category: String(row.notes ?? "").trim().startsWith("via_alt") ? "alternative" : "source",
    is_preferred: Boolean(row.is_preferred),
    is_hidden: Boolean(row.is_hidden)
  };
}

function isReportableSupplierRow(row: SupplierRow): boolean {
  if (row.is_hidden || row.item_id <= 0 || !hasText(row.supplier_name)) return false;
  if (!/^https?:\/\/\S+$/i.test(row.source_url.trim())) return false;
  if (hasText(row.status) && INTERIM_STATUS.test(row.status!)) return false;
  return hasText(row.evidence) || hasText(row.match_reasoning);
}

function uniqueItemIds(values: number[]): number[] {
  return [...new Set(values.filter((value) => Number.isInteger(value) && value > 0))].sort((left, right) => left - right);
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function textFrom(row: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = row[key];
    if (value != null && String(value).trim()) return String(value);
  }
  return null;
}
