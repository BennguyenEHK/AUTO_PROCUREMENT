"use client";

import { AlertTriangle, Loader2, RefreshCcw, X } from "lucide-react";
import {
  CurrencySelector,
  ItemSearch,
  PricingActions,
  PricingItemList,
  PricingPanelProvider,
  ProfitSummaryTable,
  usePricingPanel
} from "./index";

function PricingPanelInner({ rfqId }: { rfqId: number | null }) {
  const { isLoading, error, warning, clearWarning, items, dirty, loadPricing, quotationId } = usePricingPanel();

  if (isLoading) {
    return (
      <div className="panel-body">
        <div className="empty-page">
          <p><Loader2 size={18} className="spin inline-icon" /> Loading pricing data...</p>
        </div>
      </div>
    );
  }

  return (
    <section className="pricing-layout">
      <div className="panel">
        <div className="panel-header">
          <div>
            <strong>Quotation Pricing Canvas</strong>
            <p className="doc-subtitle">Edit pricing variables locally, then press Apply to save official quotation pricing.</p>
          </div>
          <button className="secondary" onClick={loadPricing} disabled={!rfqId}>
            <RefreshCcw size={16} /> Reload
          </button>
        </div>
        <div className="panel-body pricing-workspace">
          {!rfqId ? <div className="empty-page"><p>Data not available yet</p></div> : null}
          {error ? <div className="notice error"><AlertTriangle size={16} /> {error}</div> : null}
          {warning ? (
            <div className="notice warn-notice">
              <AlertTriangle size={16} />
              <span>{warning}</span>
              <button className="icon-button" onClick={clearWarning} aria-label="Dismiss warning"><X size={14} /></button>
            </div>
          ) : null}
          {dirty ? <div className="notice">Unsaved pricing edits. Typing only changes this page; Apply calculates and saves to the database.</div> : null}
          {rfqId && !error && items.length === 0 ? <div className="empty-page"><p>Data not available yet</p></div> : null}
          {items.length > 0 ? (
            <>
              <ItemSearch />
              <CurrencySelector />
              <PricingItemList />
            </>
          ) : null}
        </div>
      </div>
      <aside className="panel summary-board">
        <div className="panel-header">
          <div>
            <strong>Pricing Summary</strong>
            <p className="doc-subtitle">{quotationId ? `Quotation ${quotationId}` : "No saved quotation yet"}</p>
          </div>
        </div>
        <div className="panel-body stack">
          <ProfitSummaryTable />
          <PricingActions />
        </div>
      </aside>
    </section>
  );
}

export function PricingPanel({ rfqId }: { rfqId: number | null }) {
  return (
    <PricingPanelProvider rfqId={rfqId}>
      <PricingPanelInner rfqId={rfqId} />
    </PricingPanelProvider>
  );
}
