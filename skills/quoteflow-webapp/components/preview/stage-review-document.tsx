"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Search } from "lucide-react";
import type { StageReviewDocumentData, StageReviewRow } from "@/types/documents";

const HIDDEN_KEYS = new Set(["id", "rfq_id", "company_id", "user_id", "created_at", "updated_at"]);
const NUMERIC_KEY = /(amount|balance|capacity|count|difference|length|limit|percent|price|qty|quantity|rate|ratio|rating|score|size|time|tolerance|total|value|variance|weight)/i;
const URL_KEY = /(url|uri|link|source|evidence|document|datasheet|certificate)/i;

type DataRecord = Record<string, unknown>;

function isRecord(value: unknown): value is DataRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMeaningful(value: unknown): boolean {
  return value !== null && value !== undefined && value !== "";
}

function labelFor(key: string): string {
  return key.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatValue(value: string | number | boolean): string {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return new Intl.NumberFormat().format(value);
  return value;
}

function isUrl(value: unknown, key = ""): value is string {
  return typeof value === "string" && /^(https?:\/\/|mailto:)/i.test(value) && (URL_KEY.test(key) || /^(https?:\/\/|mailto:)/i.test(value));
}

function numberFrom(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && /^[-+]?\d+(\.\d+)?$/.test(value.trim())) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function visibleEntries(record: DataRecord): Array<[string, unknown]> {
  return Object.entries(record).filter(([key, value]) => !HIDDEN_KEYS.has(key) && isMeaningful(value));
}

function primitiveValue(value: string | number | boolean, key: string): ReactNode {
  if (isUrl(value, key)) {
    return <a href={value} target="_blank" rel="noreferrer">Open source</a>;
  }

  return formatValue(value);
}

function numericSeries(value: unknown): Array<{ label: string; value: number }> | null {
  if (!Array.isArray(value) || value.length < 2) return null;

  if (value.every((entry) => numberFrom(entry) !== null)) {
    return value.map((entry, index) => ({ label: String(index + 1), value: numberFrom(entry)! }));
  }

  if (!value.every(isRecord)) return null;
  const records = value as DataRecord[];
  const candidateKeys = Object.keys(records[0] ?? {}).filter((key) => records.every((record) => numberFrom(record[key]) !== null));
  const numericKey = candidateKeys.find((key) => NUMERIC_KEY.test(key)) ?? candidateKeys[0];
  if (!numericKey) return null;

  return records.map((record, index) => ({
    label: String(record.label ?? record.name ?? record.item ?? record.item_id ?? index + 1),
    value: numberFrom(record[numericKey])!
  }));
}

function NumericSeries({ series }: { series: Array<{ label: string; value: number }> }) {
  const max = Math.max(...series.map((point) => Math.abs(point.value)), 1);

  return (
    <div aria-label="Numeric series" style={{ display: "grid", gap: 8, marginTop: 10 }}>
      {series.map((point, index) => (
        <div key={`${point.label}-${index}`} style={{ display: "grid", gridTemplateColumns: "minmax(72px, 0.5fr) minmax(80px, 2fr) auto", gap: 8, alignItems: "center", fontSize: 12 }}>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{point.label}</span>
          <span aria-hidden="true" style={{ height: 8, background: "#e4ecea", overflow: "hidden", borderRadius: 4 }}>
            <span style={{ display: "block", width: `${Math.max((Math.abs(point.value) / max) * 100, 2)}%`, height: "100%", background: "var(--accent)" }} />
          </span>
          <strong>{formatValue(point.value)}</strong>
        </div>
      ))}
    </div>
  );
}

function PrimitiveList({ values, itemKey }: { values: Array<string | number | boolean>; itemKey: string }) {
  return (
    <ul style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 5 }}>
      {values.map((entry, index) => <li key={`${itemKey}-${index}`}>{primitiveValue(entry, itemKey)}</li>)}
    </ul>
  );
}

function RecordTable({ rows, depth }: { rows: DataRecord[]; depth: number }) {
  const columns = Array.from(new Set(rows.flatMap((row) => visibleEntries(row).map(([key]) => key)))).slice(0, 8);
  if (columns.length === 0) return null;

  return (
    <div className="table-wrap" style={{ marginTop: 10 }}>
      <table>
        <thead><tr>{columns.map((key) => <th key={key}>{labelFor(key)}</th>)}</tr></thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={row.id as string | number ?? rowIndex}>
              {columns.map((key) => <td key={key}><ValueRenderer value={row[key]} valueKey={key} depth={depth + 1} compact /></td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ObjectDetails({ record, depth }: { record: DataRecord; depth: number }) {
  const entries = visibleEntries(record);
  const numericEntries = entries.filter(([key, value]) => numberFrom(value) !== null && NUMERIC_KEY.test(key));
  const otherEntries = entries.filter((entry) => !numericEntries.includes(entry));

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {numericEntries.length > 0 ? (
        <section aria-label="Numeric comparison" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 8 }}>
          {numericEntries.map(([key, value]) => (
            <div className="metric" key={key} style={{ border: "1px solid var(--line)", borderRadius: 6, padding: 10 }}>
              <strong>{labelFor(key)}</strong>
              <span>{formatValue(numberFrom(value)!)}</span>
            </div>
          ))}
        </section>
      ) : null}
      {otherEntries.map(([key, value]) => (
        <section key={key} style={{ borderTop: "1px solid var(--line)", paddingTop: 10 }}>
          <h3 style={{ margin: "0 0 8px", fontSize: 14 }}>{labelFor(key)}</h3>
          <ValueRenderer value={value} valueKey={key} depth={depth + 1} />
        </section>
      ))}
    </div>
  );
}

function ValueRenderer({ value, valueKey, depth, compact = false }: { value: unknown; valueKey: string; depth: number; compact?: boolean }): ReactNode {
  if (!isMeaningful(value)) return <span>-</span>;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return <span>{primitiveValue(value, valueKey)}</span>;
  if (depth > 5) return <span>Additional structured details available.</span>;

  if (Array.isArray(value)) {
    if (value.length === 0) return <span>None</span>;
    const series = numericSeries(value);
    if (series && !compact) return <NumericSeries series={series} />;
    if (value.every((entry) => typeof entry === "string" || typeof entry === "number" || typeof entry === "boolean")) {
      return <PrimitiveList values={value as Array<string | number | boolean>} itemKey={valueKey} />;
    }
    if (value.every(isRecord)) return <RecordTable rows={value as DataRecord[]} depth={depth} />;
    return <span>Mixed detail list ({value.length} entries)</span>;
  }

  if (isRecord(value)) return <ObjectDetails record={value} depth={depth} />;
  return <span>{String(value)}</span>;
}

function rowLabel(row: StageReviewRow, index: number): string {
  return row.item_id != null ? `Item ${row.item_id}` : `Record ${index + 1}`;
}

export function StageReviewDocument({ data }: { data: StageReviewDocumentData }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [search, setSearch] = useState("");
  const visibleRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return data.rows
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => !term || [row.item_id, row.supplier_name, row.status, row.summary]
        .some((value) => String(value ?? "").toLowerCase().includes(term)));
  }, [data.rows, search]);
  if (data.rows.length === 0) {
    return <article className="empty-page"><p>Data not available yet</p></article>;
  }
  const activeIndex = Math.min(selectedIndex, data.rows.length - 1);
  const selected = data.rows[activeIndex];
  const payload = { ...selected.payload };

  return (
    <article className="stack">
      <header>
        <h1 className="doc-title">{data.title}</h1>
        <p className="doc-subtitle">{data.subtitle}</p>
      </header>

      <section className="stage-master-list" aria-label="Review items">
        <label className="workspace-search">
          <Search size={16} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search item, supplier, status, or summary" aria-label="Search review items" />
        </label>
        <div className="stage-review-grid" role="listbox" aria-label="Available review items">
          <div className="stage-review-columns" aria-hidden="true"><span>Item</span><span>Supplier</span><span>Status</span><span>Summary</span></div>
          {visibleRows.map(({ row, index }) => (
            <button key={`${row.id ?? row.item_id ?? "row"}-${index}`} type="button" className={`stage-review-row${index === activeIndex ? " selected" : ""}`} onClick={() => setSelectedIndex(index)} role="option" aria-selected={index === activeIndex}>
              <span>{rowLabel(row, index)}</span><span>{row.supplier_name || "-"}</span><span>{row.status || "-"}</span><span>{row.summary || "No summary"}</span>
            </button>
          ))}
          {!visibleRows.length ? <div className="empty-mini"><p>No matching review items.</p></div> : null}
        </div>
      </section>

      <section aria-labelledby="selected-review-heading" style={{ borderTop: "2px solid var(--accent)", paddingTop: 14 }}>
        <header style={{ marginBottom: 14 }}>
          <h2 id="selected-review-heading" style={{ margin: 0, fontSize: 20 }}>{rowLabel(selected, activeIndex)}</h2>
          {selected.supplier_name ? <p className="doc-subtitle">{selected.supplier_name}</p> : null}
          {selected.status ? <p style={{ margin: "6px 0 0", fontWeight: 700 }}>Status: {selected.status}</p> : null}
          {selected.summary ? <p style={{ margin: "6px 0 0" }}>{selected.summary}</p> : null}
        </header>
        <ObjectDetails record={payload} depth={0} />
      </section>
    </article>
  );
}
