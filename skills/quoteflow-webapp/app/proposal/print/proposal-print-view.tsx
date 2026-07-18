"use client";

import { useEffect, useRef, useState } from "react";
import { Printer, X } from "lucide-react";
import { ProposalDocument } from "@/components/proposal/proposal-document";
import type { ProposalDocument as ProposalDocumentData, ProposalMode } from "@/types/proposal";

interface ProposalPayload {
  success: boolean;
  document?: ProposalDocumentData;
  error?: string;
}

export function ProposalPrintView({ rfqId, mode, autoPrint }: { rfqId: number | null; mode: ProposalMode; autoPrint: boolean }) {
  const [document, setDocument] = useState<ProposalDocumentData | null>(null);
  const [error, setError] = useState<string | null>(rfqId ? null : "A valid RFQ is required.");
  const [loading, setLoading] = useState(Boolean(rfqId));
  const autoPrintStarted = useRef(false);

  useEffect(() => {
    if (!rfqId) return;
    const controller = new AbortController();

    async function loadProposal() {
      try {
        const response = await fetch(`/api/proposal?rfqId=${rfqId}&mode=${mode}`, {
          cache: "no-store",
          signal: controller.signal
        });
        const payload = (await response.json()) as ProposalPayload;
        if (!response.ok || !payload.success || !payload.document) {
          throw new Error(payload.error || "Proposal failed to load.");
        }
        setDocument(payload.document);
      } catch (loadError) {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : "Proposal failed to load.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    loadProposal();
    return () => controller.abort();
  }, [mode, rfqId]);

  useEffect(() => {
    if (!autoPrint || !document || autoPrintStarted.current) return;
    autoPrintStarted.current = true;
    let cancelled = false;

    async function printAfterImagesLoad() {
      const images = Array.from(window.document.images);
      await Promise.all(images.map((image) => {
        if (image.complete) return Promise.resolve();
        return new Promise<void>((resolve) => {
          image.addEventListener("load", () => resolve(), { once: true });
          image.addEventListener("error", () => resolve(), { once: true });
        });
      }));
      if (!cancelled) window.requestAnimationFrame(() => window.print());
    }

    void printAfterImagesLoad();
    return () => { cancelled = true; };
  }, [autoPrint, document]);

  return (
    <main className="proposal-print-view">
      <div className="print-toolbar" aria-label="Print controls">
        <strong>{mode === "commercial" ? "Commercial" : "Technical"} proposal</strong>
        <div className="actions">
          <button className="secondary" type="button" onClick={() => window.close()}><X size={16} /> Close</button>
          <button className="primary" type="button" onClick={() => window.print()} disabled={!document}><Printer size={16} /> Print</button>
        </div>
      </div>
      {loading ? <div className="print-status">Loading proposal...</div> : null}
      {error ? <div className="print-status error">{error}</div> : null}
      {document ? <ProposalDocument document={document} items={document.quotation_items} mode={mode} /> : null}
    </main>
  );
}
