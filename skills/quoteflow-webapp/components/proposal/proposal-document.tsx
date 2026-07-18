"use client";

import { useState } from "react";
import type { FocusEvent, HTMLAttributes } from "react";
import { Trash2 } from "lucide-react";
import type {
  ProposalColumnGroup,
  ProposalCoreColumnId,
  ProposalDocument as ProposalDocumentData,
  ProposalItem,
  ProposalLayoutConfig,
  ProposalManualRow,
  ProposalMode
} from "@/types/proposal";

interface ProposalDocumentProps {
  document: ProposalDocumentData;
  items: ProposalItem[];
  mode: ProposalMode;
  layout?: ProposalLayoutConfig;
  editable?: boolean;
  onItemChange?: (item: ProposalItem) => void;
  onLayoutChange?: (layout: ProposalLayoutConfig) => void;
  onCommercialTermsChange?: (commercialTerms: string) => void;
}

interface TableColumn {
  id: string;
  label: string;
  group: "item" | ProposalColumnGroup;
  weight: number;
  core?: ProposalCoreColumnId;
}

const EMPTY_LAYOUT: ProposalLayoutConfig = {
  version: 1,
  columns: [],
  manual_rows: [],
  rfq_column_values: {}
};

const money = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 });

export function proposalNumber(value: unknown): number {
  const parsed = Number(String(value ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function proposalTotal(items: ProposalItem[]): number {
  return items.reduce((sum, item) => sum + proposalNumber(item.ext_price), 0);
}

function formatMoney(value: unknown): string {
  return money.format(proposalNumber(value));
}

function ccLines(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === "string") return value.split(/[,;\r\n]+/).map((item) => item.trim()).filter(Boolean);
  return [];
}

function editableText(event: FocusEvent<HTMLElement>): string {
  return event.currentTarget.innerText.trim();
}

function tableColumns(mode: ProposalMode, layout: ProposalLayoutConfig): TableColumn[] {
  const custom = layout.columns.filter((column) => column.mode === mode);
  const companyCustom: TableColumn[] = custom
    .filter((column) => column.group === "company")
    .map((column) => ({ id: column.id, label: column.label, group: "company", weight: 14 }));
  const bidderCustom: TableColumn[] = custom
    .filter((column) => column.group === "bidder")
    .map((column) => ({ id: column.id, label: column.label, group: "bidder", weight: 14 }));

  const companyColumns: TableColumn[] = [
    { id: "company_description", core: "company_description", label: "Description", group: "company", weight: 34 },
    { id: "uom", core: "uom", label: "UOM", group: "company", weight: 8 },
    { id: "qty", core: "qty", label: "Qty", group: "company", weight: 8 },
    ...companyCustom
  ];
  const bidderColumns: TableColumn[] = [
    { id: "bidder_description", core: "bidder_description", label: "Description", group: "bidder", weight: 32 },
    ...(mode === "commercial" ? [
      { id: "sales_unit_price", core: "sales_unit_price" as const, label: "Unit price", group: "bidder" as const, weight: 14 },
      { id: "ext_price", core: "ext_price" as const, label: "Ext. price", group: "bidder" as const, weight: 14 }
    ] : []),
    { id: "delivery_time", core: "delivery_time", label: "Delivery time", group: "bidder", weight: 12 },
    ...bidderCustom
  ];

  return [
    { id: "item_no", core: "item_no", label: "Item No.", group: "item", weight: 6 },
    ...companyColumns,
    ...bidderColumns
  ];
}

function columnClass(column: TableColumn): string {
  return [
    column.core === "item_no" ? "item-no-col" : "",
    column.core === "qty" || column.core === "sales_unit_price" || column.core === "ext_price" ? "number" : "",
    column.core === "sales_unit_price" || column.core === "ext_price" ? "price-cell" : ""
  ].filter(Boolean).join(" ");
}

function BrandingAsset({ asset, alt, className }: { asset: "logo" | "signature"; alt: string; className: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <div className={`asset-placeholder ${className}`} role="img" aria-label={`${alt} unavailable`}>{alt} unavailable</div>;
  }

  return (
    <img
      className={className}
      src={`/api/branding/${asset}`}
      alt={alt}
      draggable={false}
      onError={() => setFailed(true)}
    />
  );
}

export function ProposalDocument({
  document,
  items,
  mode,
  layout = EMPTY_LAYOUT,
  editable = false,
  onItemChange,
  onLayoutChange,
  onCommercialTermsChange
}: ProposalDocumentProps) {
  const isCommercial = mode === "commercial";
  const total = proposalTotal(items);
  const columns = tableColumns(mode, layout);
  const companyColumnCount = columns.filter((column) => column.group === "company").length;
  const bidderColumnCount = columns.filter((column) => column.group === "bidder").length;
  const manualRows = layout.manual_rows.filter((row) => row.mode === mode);
  const totalWeight = columns.reduce((sum, column) => sum + column.weight, 0);
  const editableProps: HTMLAttributes<HTMLElement> = editable
    ? { contentEditable: true, suppressContentEditableWarning: true }
    : {};

  function commitItem(item: ProposalItem, update: Partial<ProposalItem>) {
    if (!editable || !onItemChange) return;
    onItemChange({ ...item, ...update });
  }

  function commitRfqCustomValue(itemId: number, columnId: string, value: string) {
    if (!editable || !onLayoutChange) return;
    const rowValues = layout.rfq_column_values[String(itemId)] ?? {};
    onLayoutChange({
      ...layout,
      rfq_column_values: {
        ...layout.rfq_column_values,
        [String(itemId)]: { ...rowValues, [columnId]: value }
      }
    });
  }

  function commitManualValue(row: ProposalManualRow, columnId: string, value: string) {
    if (!editable || !onLayoutChange) return;
    onLayoutChange({
      ...layout,
      manual_rows: layout.manual_rows.map((candidate) => candidate.id === row.id
        ? { ...candidate, values: { ...candidate.values, [columnId]: value } }
        : candidate)
    });
  }

  function removeManualRow(rowId: string) {
    if (!editable || !onLayoutChange) return;
    onLayoutChange({
      ...layout,
      manual_rows: layout.manual_rows.filter((row) => row.id !== rowId)
    });
  }

  function rfqCell(item: ProposalItem, column: TableColumn) {
    const className = columnClass(column);
    if (!column.core) {
      return (
        <td
          key={column.id}
          className={className}
          {...editableProps}
          onBlur={editable ? (event) => commitRfqCustomValue(item.item_id, column.id, editableText(event)) : undefined}
        >{layout.rfq_column_values[String(item.item_id)]?.[column.id] ?? ""}</td>
      );
    }

    switch (column.core) {
      case "item_no":
        return <td key={column.id} className={className}>{item.item_id}</td>;
      case "company_description":
        return (
          <td key={column.id} className={className} {...editableProps} onBlur={editable ? (event) => commitItem(item, {
            company_requirement: { ...item.company_requirement, company_description: editableText(event) }
          }) : undefined}>{item.company_requirement.company_description}</td>
        );
      case "uom":
        return (
          <td key={column.id} className={className} {...editableProps} onBlur={editable ? (event) => commitItem(item, {
            company_requirement: { ...item.company_requirement, uom: editableText(event) }
          }) : undefined}>{item.company_requirement.uom}</td>
        );
      case "qty":
        return (
          <td key={column.id} className={className} {...editableProps} onBlur={editable ? (event) => {
            const companyRequirement = { ...item.company_requirement, qty: proposalNumber(editableText(event)) };
            commitItem(item, {
              company_requirement: companyRequirement,
              ext_price: Math.round(companyRequirement.qty * proposalNumber(item.sales_unit_price))
            });
          } : undefined}>{item.company_requirement.qty}</td>
        );
      case "bidder_description":
        return (
          <td key={column.id} className={className} {...editableProps} onBlur={editable ? (event) => commitItem(item, {
            bidder_proposal: { ...item.bidder_proposal, bidder_description: editableText(event) }
          }) : undefined}>{item.bidder_proposal.bidder_description}</td>
        );
      case "sales_unit_price":
        return (
          <td key={column.id} className={className} {...editableProps} onBlur={editable ? (event) => {
            const salesUnitPrice = proposalNumber(editableText(event));
            commitItem(item, {
              sales_unit_price: salesUnitPrice,
              ext_price: Math.round(proposalNumber(item.company_requirement.qty) * salesUnitPrice)
            });
          } : undefined}>{formatMoney(item.sales_unit_price)}</td>
        );
      case "ext_price":
        return <td key={column.id} className={className}>{formatMoney(item.ext_price)}</td>;
      case "delivery_time":
        return (
          <td key={column.id} className={className} {...editableProps} onBlur={editable ? (event) => commitItem(item, {
            bidder_proposal: { ...item.bidder_proposal, delivery_time: editableText(event) }
          }) : undefined}>{item.bidder_proposal.delivery_time}</td>
        );
    }
  }

  function manualCell(row: ProposalManualRow, column: TableColumn) {
    const value = row.values[column.id] ?? "";
    if (column.core === "item_no") {
      return (
        <td key={column.id} className={columnClass(column)}>
          <span
            {...editableProps}
            onBlur={editable ? (event) => commitManualValue(row, column.id, editableText(event)) : undefined}
          >{value}</span>
          {editable ? (
            <button
              type="button"
              className="actions"
              title="Remove manual row"
              aria-label="Remove manual row"
              onClick={() => removeManualRow(row.id)}
              style={{ margin: "4px auto 0", padding: 2, border: 0, background: "transparent" }}
            ><Trash2 size={14} /></button>
          ) : null}
        </td>
      );
    }

    return (
      <td
        key={column.id}
        className={columnClass(column)}
        {...editableProps}
        onBlur={editable ? (event) => commitManualValue(row, column.id, editableText(event)) : undefined}
      >{value}</td>
    );
  }

  return (
    <article className={`proposal-page proposal-document proposal-document--${mode}`}>
      <div className="proposal-inner">
        <div className="top-logo">
          <BrandingAsset asset="logo" alt="Company letterhead" className="branding-logo" />
        </div>
        <div className="company-info-header">
          <h3><strong {...editableProps}>{document.seller_info.company_name}</strong></h3>
          <h3 {...editableProps}>{document.seller_info.address}</h3>
          <h3><strong>Tel:</strong> <span {...editableProps}>{document.seller_info.tel}</span> &nbsp;&nbsp; <strong>Fax:</strong> <span {...editableProps}>{document.seller_info.fax_number}</span></h3>
        </div>
        <div className="proposal-title">
          <h3><strong>{isCommercial ? "COMMERCIAL PROPOSAL" : "TECHNICAL PROPOSAL"}</strong></h3>
          <p><strong>RFQ Reference: </strong><span {...editableProps}>{document.rfq_reference}</span></p>
        </div>
        <div className="customer-info">
          <p><strong>To:</strong> <span className="company-name" {...editableProps}>{document.customer_info.company_name}</span></p>
          <p className="address" {...editableProps}>{document.customer_info.customer_address}</p>
          <p><strong>Tel:</strong> <span {...editableProps}>{document.customer_info.tel}</span> &nbsp;&nbsp;&nbsp;&nbsp; <strong>Fax:</strong> <span {...editableProps}>{document.customer_info.fax_number}</span></p>
          <br />
          <p><strong>Attn:</strong> <span {...editableProps}>{document.customer_info.attention_person}</span></p>
          {ccLines(document.customer_info.carbon_copy_person).map((cc, index) => <p key={`${cc}-${index}`}><strong>Cc:</strong> <span {...editableProps}>{cc}</span></p>)}
          <div className="doc-metadata">
            <p>Quotation No.: <span {...editableProps}>{document.quotation_id ?? "N/A"}</span></p>
            <p {...editableProps}>{document.quotation_date}</p>
            <p>Page: <span {...editableProps}>{document.page_number}</span></p>
          </div>
        </div>
        <p className="subject-line">Subj: <span {...editableProps}>{document.rfq_reference}</span></p>
        <h4 className="scope-title">I.&nbsp;&nbsp;SCOPE OF SUPPLY</h4>
        <div style={{ maxWidth: "100%", overflowX: "auto" }}>
          <table className="quotation-table">
            <colgroup>
              {columns.map((column) => <col key={column.id} style={{ width: `${(column.weight / totalWeight) * 100}%` }} />)}
            </colgroup>
            <thead>
              <tr>
                <th></th>
                <th colSpan={companyColumnCount} className="company-header">COMPANY&apos;S REQUIREMENT</th>
                <th colSpan={bidderColumnCount} className="bidder-header">BIDDER&apos;S PROPOSAL</th>
              </tr>
              <tr>
                {columns.map((column) => (
                  <th
                    key={column.id}
                    className={`${column.group === "company" ? "company-child" : column.group === "bidder" ? "bidder-child" : "item-no-col"} ${columnClass(column)}`.trim()}
                  >{column.core === "sales_unit_price" || column.core === "ext_price" ? `${column.label} (${document.currency})` : column.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => <tr key={`rfq-${item.item_id}`}>{columns.map((column) => rfqCell(item, column))}</tr>)}
              {manualRows.map((row) => <tr key={row.id}>{columns.map((column) => manualCell(row, column))}</tr>)}
            </tbody>
            {isCommercial ? (
              <tfoot>
                <tr className="total-row price-row">
                  <td colSpan={columns.findIndex((column) => column.core === "ext_price")} className="total-label"><strong>SUM (Exclusive of VAT):</strong></td>
                  <td className="number"><strong>{formatMoney(total)}</strong></td>
                  {columns.slice(columns.findIndex((column) => column.core === "ext_price") + 1).map((column) => <td key={column.id}></td>)}
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
        <div className="footer">
          <h4>II.&nbsp;&nbsp;TERMS AND CONDITIONS</h4>
          <p
            {...editableProps}
            onBlur={editable ? (event) => onCommercialTermsChange?.(editableText(event)) : undefined}
          >{document.commercial_terms}</p>
        </div>
        <div className="signature-section">
          <p><strong>Authorized by:</strong></p>
          <BrandingAsset asset="signature" alt="Authorized signature and company stamp" className="branding-signature" />
        </div>
      </div>
    </article>
  );
}
