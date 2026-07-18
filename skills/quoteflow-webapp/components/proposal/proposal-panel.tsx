"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Columns3, Plus, Printer, RefreshCcw, Save, Trash2 } from "lucide-react";
import { saveProposal } from "@/app/actions/proposal";
import { ProposalDocument, proposalTotal } from "@/components/proposal/proposal-document";
import type {
  ProposalCustomColumn,
  ProposalDocument as ProposalDocumentData,
  ProposalItem,
  ProposalLayoutConfig,
  ProposalMode,
  ProposalSaveRow
} from "@/types/proposal";

interface ProposalPayload {
  success: boolean;
  document?: ProposalDocumentData;
  error?: string;
}

function cloneItems(items: ProposalItem[]): ProposalItem[] {
  return items.map((item) => ({
    ...item,
    company_requirement: { ...item.company_requirement },
    bidder_proposal: { ...item.bidder_proposal }
  }));
}

function cloneLayout(layout?: ProposalLayoutConfig | null): ProposalLayoutConfig {
  return {
    version: 1,
    columns: (layout?.columns ?? []).map((column) => ({ ...column })),
    manual_rows: (layout?.manual_rows ?? []).map((row) => ({ ...row, values: { ...row.values } })),
    rfq_column_values: Object.fromEntries(
      Object.entries(layout?.rfq_column_values ?? {}).map(([itemId, values]) => [itemId, { ...values }])
    )
  };
}

function newEditorId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function omitValue(values: Record<string, string>, key: string): Record<string, string> {
  return Object.fromEntries(Object.entries(values).filter(([candidate]) => candidate !== key));
}

export function ProposalPanel({ rfqId }: { rfqId: number | null }) {
  const [mode, setMode] = useState<ProposalMode>("technical");
  const [document, setDocument] = useState<ProposalDocumentData | null>(null);
  const [items, setItems] = useState<ProposalItem[]>([]);
  const [layout, setLayout] = useState<ProposalLayoutConfig>(() => cloneLayout());
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  async function loadProposal() {
    if (!rfqId) {
      setDocument(null);
      setItems([]);
      setLayout(cloneLayout());
      setDirty(false);
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/proposal?rfqId=${rfqId}`, { cache: "no-store" });
      const payload = (await response.json()) as ProposalPayload;
      if (!response.ok || !payload.success || !payload.document) throw new Error(payload.error || "Proposal failed.");
      setDocument(payload.document);
      setItems(cloneItems(payload.document.quotation_items));
      setLayout(cloneLayout(payload.document.proposal_layout));
      setDirty(false);
    } catch (error) {
      setDocument(null);
      setItems([]);
      setLayout(cloneLayout());
      setMessage(error instanceof Error ? error.message : "Proposal failed.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadProposal();
    // The mode changes only the local table projection, not the source proposal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rfqId]);

  function updateItem(nextItem: ProposalItem) {
    setItems((current) => current.map((item) => item.item_id === nextItem.item_id ? nextItem : item));
    setDirty(true);
  }

  function updateLayout(nextLayout: ProposalLayoutConfig) {
    setLayout(nextLayout);
    setDirty(true);
  }

  function updateCommercialTerms(commercialTerms: string) {
    if (!document) return;
    setDocument({ ...document, commercial_terms: commercialTerms });
    setDirty(true);
  }

  function addColumn() {
    const modeColumnCount = layout.columns.filter((column) => column.mode === mode).length;
    updateLayout({
      ...layout,
      columns: [
        ...layout.columns,
        {
          id: newEditorId("column"),
          label: `Custom ${modeColumnCount + 1}`,
          group: "bidder",
          mode
        }
      ]
    });
  }

  function updateColumn(columnId: string, update: Partial<ProposalCustomColumn>) {
    updateLayout({
      ...layout,
      columns: layout.columns.map((column) => column.id === columnId ? { ...column, ...update } : column)
    });
  }

  function moveColumn(columnId: string, direction: -1 | 1) {
    const column = layout.columns.find((candidate) => candidate.id === columnId);
    if (!column) return;
    const peers = layout.columns.filter((candidate) => candidate.mode === column.mode && candidate.group === column.group);
    const peerIndex = peers.findIndex((candidate) => candidate.id === columnId);
    const swapWith = peers[peerIndex + direction];
    if (!swapWith) return;
    const nextColumns = [...layout.columns];
    const sourceIndex = nextColumns.findIndex((candidate) => candidate.id === columnId);
    const targetIndex = nextColumns.findIndex((candidate) => candidate.id === swapWith.id);
    [nextColumns[sourceIndex], nextColumns[targetIndex]] = [nextColumns[targetIndex], nextColumns[sourceIndex]];
    updateLayout({ ...layout, columns: nextColumns });
  }

  function removeColumn(columnId: string) {
    updateLayout({
      ...layout,
      columns: layout.columns.filter((column) => column.id !== columnId),
      manual_rows: layout.manual_rows.map((row) => ({ ...row, values: omitValue(row.values, columnId) })),
      rfq_column_values: Object.fromEntries(
        Object.entries(layout.rfq_column_values).map(([itemId, values]) => [itemId, omitValue(values, columnId)])
      )
    });
  }

  function addManualRow() {
    const rowNumber = layout.manual_rows.filter((row) => row.mode === mode).length + 1;
    updateLayout({
      ...layout,
      manual_rows: [
        ...layout.manual_rows,
        { id: newEditorId("row"), mode, values: { item_no: `M${rowNumber}` } }
      ]
    });
  }

  async function submitProposal() {
    if (!document || !rfqId) return;
    setSaving(true);
    setMessage("Saving proposal edits...");
    const rows: ProposalSaveRow[] = items.map((item) => ({
      item_id: item.item_id,
      supplier_status_id: item.supplier_status_id,
      company_description: item.company_requirement.company_description,
      uom: item.company_requirement.uom,
      qty: item.company_requirement.qty,
      bidder_description: item.bidder_proposal.bidder_description,
      delivery_time: item.bidder_proposal.delivery_time,
      sales_unit_price: item.sales_unit_price,
      ext_price: item.ext_price
    }));
    const result = await saveProposal({
      rfq_id: rfqId,
      quotation_id: document.quotation_id ?? null,
      rows,
      total_amount: proposalTotal(items),
      commercial_terms: document.commercial_terms,
      layout
    });
    setSaving(false);
    if (!result.success) {
      setMessage(result.error);
      return;
    }
    if (!result.layout_persisted) {
      setMessage(result.warning ?? "Proposal layout was not persisted. Your custom rows and columns are still unsaved.");
      return;
    }
    await loadProposal();
    setMessage("Proposal edits and layout saved.");
  }

  function refreshProposal() {
    if (dirty && !window.confirm("Discard unsaved proposal edits and refresh?")) return;
    void loadProposal();
  }

  function printProposal() {
    window.print();
  }

  const modeColumns = layout.columns.filter((column) => column.mode === mode);

  return (
    <section className="panel proposal-shell">
      <div className="panel-header">
        <div>
          <strong>Proposal</strong>
          <p className="doc-subtitle">Editable technical and commercial proposal preview for the selected RFQ.</p>
        </div>
        <div className="actions">
          <button className={mode === "technical" ? "tab active" : "tab"} onClick={() => setMode("technical")}>Technical</button>
          <button className={mode === "commercial" ? "tab active" : "tab"} onClick={() => setMode("commercial")}>Commercial</button>
          <button className="secondary" onClick={refreshProposal} disabled={!rfqId || loading || saving}><RefreshCcw size={16} /> Refresh</button>
          <button className="secondary" onClick={printProposal} disabled={!document}><Printer size={16} /> Print</button>
          <button className="primary" onClick={submitProposal} disabled={!document || !dirty || saving}><Save size={16} /> Save</button>
        </div>
      </div>
      <div className="panel-body">
        {message ? <div className={`notice actions ${message.toLowerCase().includes("failed") || message.toLowerCase().includes("required") ? "error" : ""}`.trim()}>{message}</div> : null}
        {dirty ? <div className="notice actions">Unsaved proposal edits. Press Save to persist database-backed fields.</div> : null}
        {loading ? <div className="notice actions">Loading proposal...</div> : null}
        {document ? (
          <div className="actions" aria-label="Proposal table controls" style={{ marginBottom: 14, alignItems: "stretch" }}>
            <button type="button" className="secondary" onClick={addColumn} disabled={saving}>
              <Columns3 size={16} /> Add column
            </button>
            <button type="button" className="secondary" onClick={addManualRow} disabled={saving}>
              <Plus size={16} /> Add row
            </button>
          </div>
        ) : null}
        {document && modeColumns.length > 0 ? (
          <div className="actions" aria-label={`${mode} custom columns`} style={{ display: "grid", gap: 8, marginBottom: 14 }}>
            {modeColumns.map((column) => {
              const peers = layout.columns.filter((candidate) => candidate.mode === mode && candidate.group === column.group);
              const peerIndex = peers.findIndex((candidate) => candidate.id === column.id);
              return (
                <div
                  key={column.id}
                  style={{ display: "grid", gridTemplateColumns: "minmax(150px, 1fr) 130px 36px 36px 36px", gap: 8, alignItems: "center" }}
                >
                  <input
                    value={column.label}
                    aria-label="Custom column name"
                    onChange={(event) => updateColumn(column.id, { label: event.target.value })}
                  />
                  <select
                    value={column.group}
                    aria-label={`${column.label} header group`}
                    onChange={(event) => updateColumn(column.id, { group: event.target.value as ProposalCustomColumn["group"] })}
                  >
                    <option value="company">Company</option>
                    <option value="bidder">Bidder</option>
                  </select>
                  <button type="button" className="icon-button" title="Move column left" aria-label="Move column left" onClick={() => moveColumn(column.id, -1)} disabled={peerIndex <= 0}>
                    <ArrowLeft size={16} />
                  </button>
                  <button type="button" className="icon-button" title="Move column right" aria-label="Move column right" onClick={() => moveColumn(column.id, 1)} disabled={peerIndex >= peers.length - 1}>
                    <ArrowRight size={16} />
                  </button>
                  <button type="button" className="icon-button" title="Remove column" aria-label="Remove column" onClick={() => removeColumn(column.id)}>
                    <Trash2 size={16} />
                  </button>
                </div>
              );
            })}
          </div>
        ) : null}
        {!loading && (!rfqId || !document) ? <div className="empty-page"><p>Data not available yet</p></div> : null}
        {document ? (
          <ProposalDocument
            document={document}
            items={items}
            mode={mode}
            layout={layout}
            editable
            onItemChange={updateItem}
            onLayoutChange={updateLayout}
            onCommercialTermsChange={updateCommercialTerms}
          />
        ) : null}
      </div>
    </section>
  );
}
