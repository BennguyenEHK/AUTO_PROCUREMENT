"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, RefreshCcw } from "lucide-react";
import type { DocumentData, PreviewResponse, PreviewType, ReportReadiness } from "@/types/documents";
import { RfqAnalysisDocument } from "./rfq-analysis-document";
import { SupplierSearchDocument } from "./supplier-search-document";
import { StageReviewDocument } from "./stage-review-document";

export function PreviewPanel({ rfqId, type }: { rfqId: number | null; type: PreviewType }) {
  const [document, setDocument] = useState<DocumentData | null>(null);
  const [readiness, setReadiness] = useState<ReportReadiness | null>(null);
  const [interimRows, setInterimRows] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadDocument() {
    if (!rfqId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/preview?rfqId=${rfqId}&type=${type}`, { cache: "no-store" });
      const payload = await response.json() as PreviewResponse;
      if (!payload.success) throw new Error(payload.error || "Preview failed.");
      setDocument(payload.document);
      setReadiness(payload.readiness);
      setInterimRows(payload.interim_rows?.length ?? 0);
    } catch (loadError) {
      setDocument(null);
      setReadiness(null);
      setInterimRows(0);
      setError(loadError instanceof Error ? loadError.message : "Preview failed.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDocument();
  }, [rfqId, type]);

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <strong>Document Preview</strong>
          <p className="doc-subtitle">Database-backed procurement preview for the selected RFQ.</p>
        </div>
        <div className="actions">
          <button className="secondary" onClick={loadDocument} disabled={!rfqId || loading}>
            <RefreshCcw size={16} /> Refresh
          </button>
        </div>
      </div>
      <div className="panel-body document">
        {!rfqId ? <div className="notice">Select an RFQ to load its preview.</div> : null}
        {error ? (
          <div className="notice error">
            <AlertTriangle size={16} /> {error}
          </div>
        ) : null}
        {loading ? <div className="notice">Loading preview...</div> : null}
        {!loading && readiness ? <ReadinessStatus readiness={readiness} interimRows={interimRows} /> : null}
        {document?.type === "rfq_analysis" ? <RfqAnalysisDocument data={document} /> : null}
        {document?.type === "supplier_search" ? <SupplierSearchDocument data={document} onChanged={loadDocument} /> : null}
        {document?.type === "supplier_quote_normalization" ? <StageReviewDocument data={document} /> : null}
        {document?.type === "technical_compliance_review" ? <StageReviewDocument data={document} /> : null}
        {document?.type === "certificate_origin_review" ? <StageReviewDocument data={document} /> : null}
        {!loading && rfqId && !error && !document && !readiness ? <div className="empty-page"><p>Data not available yet</p></div> : null}
      </div>
    </section>
  );
}

function ReadinessStatus({ readiness, interimRows }: { readiness: ReportReadiness; interimRows: number }) {
  if (readiness.is_ready) {
    return <div className="notice success" aria-live="polite">Final report ready. {readiness.ready_items} of {readiness.total_items} items have reportable evidence.</div>;
  }

  return (
    <section className="notice warning readiness-status" aria-live="polite">
      <strong>Final report is not ready</strong>
      <p>{readiness.message}</p>
      <p>{readiness.ready_items} of {readiness.total_items} RFQ items meet the final-report gate.{interimRows ? ` ${interimRows} interim evidence row${interimRows === 1 ? " is" : "s are"} available to the workflow.` : ""}</p>
      {readiness.blockers.length ? <ul><strong>Blockers</strong>{readiness.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul> : null}
      {readiness.requirements.length ? <ul><strong>Final-report requirements</strong>{readiness.requirements.map((requirement) => <li key={requirement}>{requirement}</li>)}</ul> : null}
    </section>
  );
}
