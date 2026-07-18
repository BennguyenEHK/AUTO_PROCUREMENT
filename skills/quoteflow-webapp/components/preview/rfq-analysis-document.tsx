"use client";

import { useRef, useState } from "react";
import type { AgentItemSummary, RfqAnalysisDocumentData } from "@/types/documents";

function lines(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "object") {
    return Object.entries(value)
      .flatMap(([key, entry]) => {
        if (Array.isArray(entry)) return entry.map((item) => `${label(key)}: ${String(item)}`);
        if (entry && typeof entry === "object") return Object.entries(entry).map(([child, item]) => `${label(key)} / ${label(child)}: ${String(item)}`);
        return entry == null || entry === "" ? [] : [`${label(key)}: ${String(entry)}`];
      });
  }
  return String(value).split(/\r?\n/).filter(Boolean);
}

const requirementGroups: Array<[string, string]> = [
  ["certificates_compliance", "Certificates / Compliance"],
  ["submission_proposal", "Submission / Proposal"],
  ["signature_authorization", "Signature / Authorization"],
  ["delivery", "Delivery"],
  ["commercial_terms", "Commercial Terms"],
  ["technical_standards_inspection", "Technical Standards / Inspection"],
  ["documentation", "Documentation"],
  ["coo_origin", "COO / Origin"],
  ["manufacturer_authorization", "Manufacturer Authorization"],
  ["commercial", "Commercial"],
  ["technical", "Technical"],
  ["submission", "Submission"],
  ["compliance", "Compliance"]
];

function label(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .replace("Coo", "COO");
}

function groupedValues(value: unknown): Array<{ label: string; values: string[] }> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const source = value as Record<string, unknown>;
  const groups = requirementGroups
    .map(([key, groupLabel]) => ({ label: groupLabel, values: lines(source[key]) }))
    .filter((group) => group.values.length > 0);
  const known = new Set(requirementGroups.map(([key]) => key));
  const extra = Object.entries(source)
    .filter(([key]) => !known.has(key))
    .flatMap(([key, entry]) => lines(entry).map((entryValue) => ({ label: label(key), value: entryValue })));
  for (const entry of extra) {
    const group = groups.find((item) => item.label === entry.label);
    if (group) group.values.push(entry.value);
    else groups.push({ label: entry.label, values: [entry.value] });
  }
  return groups;
}

function GroupedSection({ title, value, empty }: { title: string; value: unknown; empty: string }) {
  const groups = groupedValues(value);
  const fallback = lines(value);
  return (
    <section className="field">
      <strong>{title}</strong>
      {groups.length ? (
        <div className="requirement-grid">
          {groups.map((group) => (
            <div key={group.label} className="requirement-group">
              <span>{group.label}</span>
              <ul>{group.values.map((item) => <li key={item}>{item}</li>)}</ul>
            </div>
          ))}
        </div>
      ) : fallback.length ? (
        <ul>{fallback.map((line) => <li key={line}>{line}</li>)}</ul>
      ) : <span className="muted">{empty}</span>}
    </section>
  );
}

function SummaryText({ value }: { value: string }) {
  const parts = value.split(/<br\s*\/?>|\r?\n/i).map((part) => part.trim()).filter(Boolean);
  if (!parts.length) return <span className="muted">Data not available yet</span>;
  return <>{parts.map((part) => <p key={part}>{part}</p>)}</>;
}

function Summary({ summary }: { summary?: AgentItemSummary | null }) {
  if (!summary) return <span className="muted">No summary</span>;
  const sections: Array<[keyof AgentItemSummary, string]> = [
    ["purpose", "Purpose"],
    ["features", "Features"],
    ["application", "Application"],
    ["classification", "Classification"],
    ["identification", "Identification"]
  ];
  return (
    <div className="agent-summary-sections">
      {sections.map(([key, title]) => {
        const values = summary[key];
        if (!Array.isArray(values) || values.length === 0) return null;
        return (
          <section key={key} className="agent-summary-section">
            <strong>{title}:</strong>
            <ul>{values.map((value, index) => <li key={`${key}-${index}`}>{value}</li>)}</ul>
          </section>
        );
      })}
    </div>
  );
}

function ItemExplorer({ data }: { data: RfqAnalysisDocumentData }) {
  const [selectedItemIndex, setSelectedItemIndex] = useState(0);
  const itemButtons = useRef<Array<HTMLButtonElement | null>>([]);
  const hasItems = data.rfq_items.length > 0;
  const safeIndex = hasItems ? Math.min(selectedItemIndex, data.rfq_items.length - 1) : 0;
  const selectedItem = hasItems ? data.rfq_items[safeIndex] : null;

  function selectItem(index: number) {
    setSelectedItemIndex(index);
    itemButtons.current[index]?.focus();
  }

  function handleItemKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number | null = null;

    if (event.key === "ArrowDown") nextIndex = Math.min(index + 1, data.rfq_items.length - 1);
    if (event.key === "ArrowUp") nextIndex = Math.max(index - 1, 0);
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = data.rfq_items.length - 1;

    if (nextIndex !== null) {
      event.preventDefault();
      selectItem(nextIndex);
    }
  }

  return (
    <section className="stack" aria-label="RFQ item explorer">
      <div>
        <strong>Extracted RFQ Items</strong>
        <span className="muted"> {data.rfq_items.length} item{data.rfq_items.length === 1 ? "" : "s"}</span>
      </div>
      {hasItems ? (
        <div className="rfq-item-explorer">
          <div className="rfq-item-list" role="listbox" aria-label="RFQ items">
            {data.rfq_items.map((item, index) => {
              const isSelected = index === safeIndex;
              return (
                <button
                  key={item.item_id}
                  ref={(element) => { itemButtons.current[index] = element; }}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={`rfq-item-row${isSelected ? " selected" : ""}`}
                  onClick={() => selectItem(index)}
                  onKeyDown={(event) => handleItemKeyDown(event, index)}
                  style={{ textAlign: "left" }}
                >
                  <strong>Item {item.item_id}</strong>
                  <span>{item.company_description || "Description not captured"}</span>
                  <span className="muted">{item.qty} {item.uom || "UOM not captured"}</span>
                </button>
              );
            })}
          </div>
          <section className="rfq-summary-pane" aria-live="polite">
            <strong>Agent Summary: Item {selectedItem?.item_id}</strong>
            <p>{selectedItem?.company_description || "Description not captured"}</p>
            <div className="rfq-item-metadata">
              <div><strong>Quantity:</strong><span>{selectedItem?.qty}</span></div>
              <div><strong>UOM:</strong><span>{selectedItem?.uom || "Not captured"}</span></div>
            </div>
            <Summary summary={selectedItem?.agent_item_summary} />
          </section>
        </div>
      ) : <div className="notice">No items extracted for analysis.</div>}
    </section>
  );
}

export function RfqAnalysisDocument({ data }: { data: RfqAnalysisDocumentData }) {
  return (
    <article className="stack">
      <header>
        <h1 className="doc-title">{data.rfq_reference || data.subject}</h1>
        <p className="doc-subtitle">{data.subject}</p>
      </header>
      <section className="grid">
        <div className="field"><strong>Status</strong>{data.status || "Pending review"}</div>
        <div className="field"><strong>Deadline</strong>{data.deadline_period || "Not captured"}</div>
        <div className="field"><strong>Currency</strong>{data.required_currency || "Not captured"}</div>
        <div className="field"><strong>Closing time</strong>{data.closing_time || "Not captured"}</div>
      </section>
      <section className="field">
        <strong>RFQ Requirement</strong>
        <SummaryText value={data.analysis_content} />
      </section>
      <GroupedSection title="Special / Further Requirements" value={data.special_requirements} empty="Data not available yet" />
      <GroupedSection title="Required Documents" value={data.required_documents} empty="Data not available yet" />
      <GroupedSection title="Clarifications" value={data.clarifications} empty="Data not available yet" />
      <ItemExplorer data={data} />
    </article>
  );
}
