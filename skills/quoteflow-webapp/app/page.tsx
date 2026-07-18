"use client";

import { useEffect, useMemo, useState } from "react";
import type { ComponentType } from "react";
import { ClipboardList, FileCheck2, FileText, RefreshCcw, Search, ShieldCheck, UserRound } from "lucide-react";
import { SignupPanel } from "@/components/signup/signup-panel";
import { PreviewPanel } from "@/components/preview/preview-panel";
import { PricingPanel } from "@/components/pricing/pricing-panel";
import { ProposalPanel } from "@/components/proposal/proposal-panel";
import type { PreviewType } from "@/types/documents";
import {
  defaultPageUrlState,
  readPageUrlState,
  type PageTab,
  type PageUrlState,
  type PageView,
  writePageUrlState
} from "./page-url-state";

interface RfqOption {
  rfq_id: number;
  rfq_reference: string;
  subject: string;
  current_stage?: string | null;
  stage_status?: string | null;
}

const previewTypes: Array<{ type: PreviewType; label: string; icon: ComponentType<{ size?: number }> }> = [
  { type: "rfq_analysis", label: "RFQ", icon: FileText },
  { type: "supplier_search", label: "Suppliers", icon: Search },
  { type: "supplier_quote_normalization", label: "Quotes", icon: ClipboardList },
  { type: "technical_compliance_review", label: "Technical", icon: ShieldCheck },
  { type: "certificate_origin_review", label: "Certificates", icon: FileCheck2 }
];

const previewTypeByTab: Record<PageTab, PreviewType> = {
  rfq: "rfq_analysis",
  suppliers: "supplier_search",
  quotes: "supplier_quote_normalization",
  technical: "technical_compliance_review",
  certificates: "certificate_origin_review"
};

const tabByPreviewType: Record<PreviewType, PageTab> = {
  rfq_analysis: "rfq",
  supplier_search: "suppliers",
  supplier_quote_normalization: "quotes",
  technical_compliance_review: "technical",
  certificate_origin_review: "certificates"
};

type BadgeCounts = Partial<Record<PageView | PageTab, number>>;

function readBadgeCounts(payload: unknown): BadgeCounts {
  if (!payload || typeof payload !== "object") return {};
  const source = (payload as { badges?: unknown }).badges;
  if (!source || typeof source !== "object") return {};

  return Object.fromEntries(
    Object.entries(source as Record<string, unknown>).flatMap(([key, value]) =>
      typeof value === "number" && Number.isFinite(value) && value > 0 ? [[key, Math.floor(value)]] : []
    )
  ) as BadgeCounts;
}

export default function HomePage() {
  const [rfqs, setRfqs] = useState<RfqOption[]>([]);
  const [rfqId, setRfqId] = useState<number | null>(defaultPageUrlState.rfqId);
  const [activeView, setActiveView] = useState<PageView>(defaultPageUrlState.view);
  const [previewType, setPreviewType] = useState<PreviewType>(previewTypeByTab[defaultPageUrlState.tab]);
  const [loading, setLoading] = useState(false);
  const [rfqError, setRfqError] = useState<string | null>(null);
  const [badgeCounts, setBadgeCounts] = useState<BadgeCounts>({});
  const [badgesLoading, setBadgesLoading] = useState(true);
  const selected = useMemo(() => rfqs.find((rfq) => rfq.rfq_id === rfqId), [rfqs, rfqId]);

  function currentUrlState(overrides: Partial<PageUrlState> = {}): PageUrlState {
    return {
      view: activeView,
      tab: tabByPreviewType[previewType],
      rfqId,
      ...overrides
    };
  }

  function updateLocation(overrides: Partial<PageUrlState>) {
    const nextState = currentUrlState(overrides);
    setActiveView(nextState.view);
    setPreviewType(previewTypeByTab[nextState.tab]);
    setRfqId(nextState.rfqId);

    const params = writePageUrlState(nextState, new URLSearchParams(window.location.search));
    window.history.pushState(null, "", `${window.location.pathname}?${params.toString()}${window.location.hash}`);
  }

  async function loadRfqs() {
    setLoading(true);
    setRfqError(null);
    try {
      const response = await fetch("/api/rfqs", { cache: "no-store" });
      const payload = await response.json();
      if (payload.success) {
        setRfqs(payload.rfqs);
        setRfqId((current) => current ?? payload.rfqs?.[0]?.rfq_id ?? null);
      } else {
        setRfqError(payload.error || "Could not load RFQs.");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRfqs();
  }, []);

  useEffect(() => {
    let active = true;

    async function loadBadges() {
      setBadgesLoading(true);
      try {
        const response = await fetch("/api/notifications", { cache: "no-store" });
        if (!response.ok) return;
        const payload = await response.json();
        if (active) setBadgeCounts(readBadgeCounts(payload));
      } catch {
        // Notifications are supplementary until the endpoint is available.
      } finally {
        if (active) setBadgesLoading(false);
      }
    }

    loadBadges();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    function restoreLocation() {
      const state = readPageUrlState(new URLSearchParams(window.location.search));
      setActiveView(state.view);
      setPreviewType(previewTypeByTab[state.tab]);
      setRfqId(state.rfqId);
    }

    restoreLocation();
    window.addEventListener("popstate", restoreLocation);
    return () => window.removeEventListener("popstate", restoreLocation);
  }, []);

  useEffect(() => {
    if (rfqId === null) return;

    const state = currentUrlState();
    const existing = new URLSearchParams(window.location.search);
    const next = writePageUrlState(state, new URLSearchParams(existing));
    if (next.toString() !== existing.toString()) {
      window.history.replaceState(null, "", `${window.location.pathname}?${next.toString()}${window.location.hash}`);
    }
  }, [activeView, previewType, rfqId]);

  function renderBadge(key: PageView | PageTab) {
    const count = badgeCounts[key];
    if (!count) return null;
    return <span className="notification-badge" aria-label={`${count} notifications`}>{count > 99 ? "99+" : count}</span>;
  }

  return (
    <main className="shell">
      <aside className="sidebar" aria-label="QuoteFlow navigation">
        <div className="brand">
          <div className="brand-mark">QF</div>
          <div>
            <strong>QuoteFlow</strong>
            <span>Procurement workboard</span>
          </div>
        </div>
        <button className={activeView === "documents" ? "nav active" : "nav"} onClick={() => updateLocation({ view: "documents" })}>
          <FileText size={18} /> Documents {renderBadge("documents")}
        </button>
        <button className={activeView === "pricing" ? "nav active" : "nav"} onClick={() => updateLocation({ view: "pricing" })}>
          <ClipboardList size={18} /> Pricing {renderBadge("pricing")}
        </button>
        <button className={activeView === "proposal" ? "nav active" : "nav"} onClick={() => updateLocation({ view: "proposal" })}>
          <FileCheck2 size={18} /> Proposal {renderBadge("proposal")}
        </button>
        <button className={activeView === "signup" ? "nav active" : "nav"} onClick={() => updateLocation({ view: "signup" })}>
          <UserRound size={18} /> Signup {renderBadge("signup")}
        </button>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div className="rfq-picker">
            <label htmlFor="rfq">RFQ</label>
            <select id="rfq" value={rfqId ?? ""} onChange={(event) => updateLocation({ rfqId: Number(event.target.value) || null })}>
              {rfqs.length === 0 ? <option value="">No RFQs found</option> : null}
              {rfqs.map((rfq) => (
                <option key={rfq.rfq_id} value={rfq.rfq_id}>
                  {rfq.rfq_reference || `RFQ ${rfq.rfq_id}`} - {rfq.subject || "Untitled"}
                </option>
              ))}
            </select>
          </div>
          <div className="status-strip">
            <span>{selected?.current_stage || "stage unknown"}</span>
            <span>{selected?.stage_status || "status unknown"}</span>
            <button className="icon-button" title="Refresh RFQs" onClick={loadRfqs} disabled={loading}>
              <RefreshCcw size={17} />
            </button>
          </div>
        </header>
        {rfqError ? <div className="notice error">{rfqError}</div> : null}

        {activeView === "documents" ? (
          <>
            <div className="tabbar" role="tablist" aria-label="Preview type">
              {previewTypes.map(({ type, label, icon: Icon }) => (
                <button
                  key={type}
                  className={previewType === type ? "tab active" : "tab"}
                  onClick={() => updateLocation({ view: "documents", tab: tabByPreviewType[type] })}
                >
                  <Icon size={16} /> {label} {renderBadge(tabByPreviewType[type])}
                </button>
              ))}
            </div>
            <PreviewPanel rfqId={rfqId} type={previewType} />
          </>
        ) : null}

        {activeView === "pricing" ? <PricingPanel rfqId={rfqId} /> : null}
        {activeView === "proposal" ? <ProposalPanel rfqId={rfqId} /> : null}
        {activeView === "signup" ? <SignupPanel /> : null}
        {badgesLoading ? <span className="sr-only" role="status">Loading notifications</span> : null}
      </section>
    </main>
  );
}
