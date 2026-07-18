"use client";

import { useMemo, useState } from "react";
import { ExternalLink, Mail, Phone, Search, Star, Trash2 } from "lucide-react";
import { hideSupplierFromWorkboard, setSupplierPreferred } from "@/app/actions/supplier";
import type { SupplierRow, SupplierSearchDocumentData } from "@/types/documents";

function value(input?: string | number | null) {
  return input === null || input === undefined || input === "" ? "Not available" : String(input);
}

export function SupplierSearchDocument({ data, onChanged }: { data: SupplierSearchDocumentData; onChanged?: () => Promise<void> | void }) {
  const [search, setSearch] = useState("");
  const visibleRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return data.rows.filter((row) => {
      if (row.is_hidden) return false;
      if (!term) return true;
      return [row.item_id, row.supplier_name, row.manufacturer, row.bidder_description, row.source_url]
        .some((value) => String(value ?? "").toLowerCase().includes(term));
    });
  }, [data.rows, search]);
  const [selectedId, setSelectedId] = useState<number | undefined>(visibleRows[0]?.id);
  const [menuRow, setMenuRow] = useState<SupplierRow | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const selected = visibleRows.find((row) => row.id === selectedId) ?? visibleRows[0] ?? null;
  const groups = useMemo(() => {
    const next = new Map<number, SupplierRow[]>();
    for (const row of visibleRows) next.set(row.item_id, [...(next.get(row.item_id) ?? []), row]);
    return [...next.entries()];
  }, [visibleRows]);

  async function saveDecision(row: SupplierRow, action: "preferred" | "remove") {
    if (!row.id) return;
    setMessage(action === "preferred" ? "Saving preferred supplier..." : "Removing supplier from this workboard...");
    const result = action === "preferred"
      ? await setSupplierPreferred(row.id, !row.is_preferred)
      : await hideSupplierFromWorkboard(row.id);
    setMenuRow(null);
    if (!result.success) {
      setMessage(result.error);
      return;
    }
    await onChanged?.();
    setMessage(action === "preferred" ? "Preferred supplier saved." : "Supplier removed from this workboard.");
  }

  return (
    <article className="document-workspace supplier-workspace">
      <header className="document-workspace-header">
        <div>
          <h1 className="doc-title">{data.title}</h1>
          <p className="doc-subtitle">Select a source to inspect its offer and evidence.</p>
        </div>
        <span className="workspace-count">{visibleRows.length} active sources</span>
      </header>
      {message ? <div className="notice">{message}</div> : null}
      <label className="workspace-search">
        <Search size={16} />
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search item, supplier, manufacturer, or offer" aria-label="Search supplier sources" />
      </label>
      <div className="supplier-source-list" role="list" aria-label="Supplier sources">
        <div className="supplier-source-columns" aria-hidden="true"><span>Supplier / source</span><span>Bidder price</span><span>Delivery time</span></div>
        {groups.map(([itemId, rows]) => (
          <section key={itemId} className="supplier-item-group">
            <div className="supplier-item-heading">Item {itemId}<span>{rows.length} sources</span></div>
            {rows.map((row) => {
              const isSelected = selected?.id === row.id;
              return (
                <button
                  key={row.id ?? `${row.item_id}-${row.supplier_name}-${row.source_url}`}
                  className={`supplier-source-row${isSelected ? " selected" : ""}`}
                  onClick={() => setSelectedId(row.id)}
                  onContextMenu={(event) => { event.preventDefault(); setSelectedId(row.id); setMenuRow(row); }}
                >
                  <span className="supplier-source-name">{row.is_preferred ? <Star size={14} fill="currentColor" /> : null}{row.supplier_name || "Unnamed supplier"}</span>
                  <span>{value(row.currency_code)} {row.bidder_unit_price == null ? "" : row.bidder_unit_price.toLocaleString()}</span>
                  <span>{value(row.delivery_time)}</span>
                </button>
              );
            })}
          </section>
        ))}
        {!visibleRows.length ? <div className="empty-mini"><p>No active supplier sources.</p></div> : null}
      </div>
      <section className="supplier-dossier" aria-live="polite">
        {selected ? <SupplierDossier row={selected} /> : <div className="empty-mini"><p>Select a supplier source to view its details.</p></div>}
      </section>
      {menuRow ? (
        <div className="supplier-context-menu" role="menu" aria-label="Supplier actions">
          <button onClick={() => saveDecision(menuRow, "preferred")}><Star size={15} fill={menuRow.is_preferred ? "currentColor" : "none"} /> {menuRow.is_preferred ? "Remove preferred mark" : "Mark preferred"}</button>
          <button className="danger-action" onClick={() => saveDecision(menuRow, "remove")}><Trash2 size={15} /> Remove from workboard</button>
          <button className="secondary" onClick={() => setMenuRow(null)}>Close</button>
        </div>
      ) : null}
    </article>
  );
}

function SupplierDossier({ row }: { row: SupplierRow }) {
  return (
    <div className="stack">
      <div className="dossier-title"><div><span className="section-label">Selected source</span><h2>{row.supplier_name || "Unnamed supplier"}</h2><p>{value(row.manufacturer)}</p></div>{row.is_preferred ? <span className="badge">Preferred</span> : null}</div>
      <div className="grid">
        <div className="field"><strong>Offer</strong>{value(row.bidder_description)}</div>
        <div className="field"><strong>Price</strong>{value(row.currency_code)} {value(row.bidder_unit_price)}</div>
        <div className="field"><strong>Delivery</strong>{value(row.delivery_time)}</div>
        <div className="field"><strong>Availability</strong>{value(row.available_qty)} {value(row.selling_unit)}<br />Pack: {value(row.pack_size)}</div>
      </div>
      <div className="grid">
        <div className="field"><strong>Evidence and reasoning</strong>{value(row.match_reasoning || row.evidence || row.notes)}{row.source_url ? <a className="source-link" href={row.source_url} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Open source</a> : null}</div>
        <div className="field"><strong>Contact</strong><span><Mail size={14} /> {value(row.contact_email)}</span><span><Phone size={14} /> {value(row.contact_phone || row.social_contact)}</span></div>
      </div>
      {row.compliance_deviation ? <div className="notice error">{row.compliance_deviation}</div> : null}
    </div>
  );
}
