"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import type { QuotationItem } from "@/types/documents";
import type { PricingVariable } from "@/types/pricing";
import { DEFAULT_PRICING_VARIABLES, VARIABLE_FIELDS } from "@/types/pricing";
import { formatNumber, parseFormattedNumber } from "@/lib/services/pricing/validation";
import { usePricingPanel } from "./pricing-panel-provider";

type VariableField = keyof Omit<PricingVariable, "item_id">;

function rawString(field: VariableField, value: number | null): string {
  if (value == null) return "";
  return field === "discount_rate" ? String(value * 100) : String(value);
}

function formattedString(field: VariableField, value: number | null): string {
  if (value == null) return "";
  if (field === "discount_rate") return formatNumber(value * 100, 1);
  if (field === "shipping_cost" || field === "exchange_rate") return formatNumber(value, 0);
  return String(value);
}

function placeholderFor(field: VariableField): string {
  const value = DEFAULT_PRICING_VARIABLES[field];
  return field === "discount_rate" ? String(value * 100) : String(value);
}

function parseDraft(field: VariableField, value: string): number | null {
  if (value.trim() === "") return null;
  const normalized = value.trim().replace(/[.,]$/, "");
  const parsed = parseFormattedNumber(normalized);
  if (parsed == null) return null;
  return field === "discount_rate" ? parsed / 100 : parsed;
}

export const PricingItemCard = memo(function PricingItemCard({
  item,
  variables
}: {
  item: QuotationItem;
  variables: PricingVariable;
}) {
  const { supplierSelections, setSupplierSelection, updateVariable } = usePricingPanel();
  const selectedSupplierId = supplierSelections.find((selection) => selection.item_id === item.item_id)?.supplier_status_id ?? item.selected_supplier_status_id ?? "";
  const [drafts, setDrafts] = useState<Record<VariableField, string>>({
    shipping_cost: "",
    tax_rate: "",
    exchange_rate: "",
    profit_rate: "",
    discount_rate: ""
  });
  const focusedFieldRef = useRef<VariableField | null>(null);
  const commitDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (commitDebounceRef.current) clearTimeout(commitDebounceRef.current);
  }, []);

  useEffect(() => {
    setDrafts((current) => {
      const next = { ...current };
      for (const field of VARIABLE_FIELDS.map((config) => config.key)) {
        if (focusedFieldRef.current !== field) next[field] = formattedString(field, variables[field]);
      }
      return next;
    });
  }, [variables]);

  const commit = useCallback((field: VariableField, value: string) => {
    updateVariable(item.item_id, field, parseDraft(field, value));
  }, [item.item_id, updateVariable]);

  function onFocus(field: VariableField) {
    focusedFieldRef.current = field;
    setDrafts((current) => ({ ...current, [field]: rawString(field, variables[field]) }));
  }

  function onChange(field: VariableField, value: string) {
    focusedFieldRef.current = field;
    setDrafts((current) => ({ ...current, [field]: value }));
    if (commitDebounceRef.current) clearTimeout(commitDebounceRef.current);
    const immediate = parseFormattedNumber(value);
    if (value.trim() === "" || immediate != null) {
      commit(field, value);
      return;
    }
    commitDebounceRef.current = setTimeout(() => commit(field, value), 400);
  }

  function onBlur(field: VariableField) {
    if (commitDebounceRef.current) clearTimeout(commitDebounceRef.current);
    focusedFieldRef.current = null;
    commit(field, drafts[field]);
    setDrafts((current) => ({ ...current, [field]: formattedString(field, parseDraft(field, drafts[field])) }));
  }

  return (
    <div className="pricing-card" data-item-id={item.item_id}>
      <div className="item-name">
        <strong>Item {item.item_id}: {item.bidder_description || item.company_description}</strong>
        <span className="muted">
          {item.supplier_name || "Supplier not named"} | {item.currency_code} {formatNumber(item.bidder_unit_price, 2)} | Qty {formatNumber(item.qty, 2)} {item.uom}
        </span>
        {item.supplier_candidates && item.supplier_candidates.length > 1 ? (
          <label className="supplier-basis-field">
            <span className="section-label">Supplier Basis</span>
            <select value={selectedSupplierId} onChange={(event) => setSupplierSelection(item.item_id, Number(event.target.value))}>
              <option value="">Choose supplier</option>
              {item.supplier_candidates.map((supplier) => (
                <option key={supplier.supplier_status_id} value={supplier.supplier_status_id}>
                  {supplier.supplier_name || "Unnamed supplier"} | {supplier.currency_code} {formatNumber(supplier.bidder_unit_price, 2)}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {item.supplier_candidate_count && item.supplier_candidate_count > 1 ? (
          <span className="warning-text">{item.supplier_basis_warning || `${item.supplier_candidate_count} supplier candidates found`}</span>
        ) : null}
      </div>
      {VARIABLE_FIELDS.map((field) => (
        <label key={field.key}>
          <span className="section-label">{field.label}</span>
          <input
            type="text"
            inputMode="decimal"
            value={drafts[field.key]}
            onFocus={() => onFocus(field.key)}
            onChange={(event) => onChange(field.key, event.target.value)}
            onBlur={() => onBlur(field.key)}
            data-field={field.key}
            placeholder={placeholderFor(field.key)}
            autoComplete="off"
            spellCheck={false}
          />
          <small>{field.hint}</small>
        </label>
      ))}
    </div>
  );
});
