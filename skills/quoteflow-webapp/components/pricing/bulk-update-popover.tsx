"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { CheckSquare, Square, X } from "lucide-react";
import type { QuotationItem } from "@/types/documents";
import type { PricingVariable } from "@/types/pricing";
import { VARIABLE_FIELDS } from "@/types/pricing";
import { parseFormattedNumber } from "@/lib/services/pricing/validation";
import { usePricingPanel } from "./pricing-panel-provider";

type VariableField = keyof Omit<PricingVariable, "item_id">;

interface BulkUpdatePopoverProps {
  field: VariableField;
  items: QuotationItem[];
  initialValue: string;
  position: { x: number; y: number };
  onClose: () => void;
}

function parseValue(field: VariableField, value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = parseFormattedNumber(value);
  if (parsed == null) return null;
  return field === "discount_rate" ? parsed / 100 : parsed;
}

export function BulkUpdatePopover({ field, items, initialValue, position, onClose }: BulkUpdatePopoverProps) {
  const { bulkUpdateVariable } = usePricingPanel();
  // A new bulk operation is opt-in: no items are selected until the user chooses them.
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set());
  const [value, setValue] = useState(initialValue);
  const fieldConfig = VARIABLE_FIELDS.find((config) => config.key === field);
  const allSelected = selectedIds.size === items.length;
  const adjustedPosition = useMemo(() => {
    const width = 320;
    const height = 380;
    if (typeof window === "undefined") return position;
    return {
      x: Math.max(12, Math.min(position.x, window.innerWidth - width - 12)),
      y: Math.max(12, Math.min(position.y, window.innerHeight - height - 12))
    };
  }, [position]);

  function toggleAll() {
    setSelectedIds(allSelected ? new Set() : new Set(items.map((item) => item.item_id)));
  }

  function toggleItem(itemId: number) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  function applyBulk() {
    if (selectedIds.size === 0) return;
    bulkUpdateVariable(Array.from(selectedIds), field, parseValue(field, value));
    onClose();
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="bulk-popover-layer"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="bulk-popover"
        style={{ left: adjustedPosition.x, top: adjustedPosition.y }}
        role="dialog"
        aria-label="Apply value to multiple items"
      >
        <div className="bulk-popover-header">
          <strong>Apply to Multiple Items</strong>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            <X size={15} />
          </button>
        </div>
        <button className="bulk-select-row" onClick={toggleAll}>
          {allSelected ? <CheckSquare size={16} /> : <Square size={16} />}
          Apply to all visible items
        </button>
        <div className="bulk-item-list">
          {items.map((item) => {
            const selected = selectedIds.has(item.item_id);
            return (
              <button key={item.item_id} className="bulk-select-row" onClick={() => toggleItem(item.item_id)}>
                {selected ? <CheckSquare size={15} /> : <Square size={15} />}
                <span>Item {item.item_id}: {item.bidder_description || item.company_description}</span>
              </button>
            );
          })}
        </div>
        <label>
          <span className="section-label">{fieldConfig?.label || field.replaceAll("_", " ")}</span>
          <input value={value} onChange={(event) => setValue(event.target.value)} autoFocus />
        </label>
        <button className="primary bulk-apply" onClick={applyBulk} disabled={selectedIds.size === 0}>
          Apply
        </button>
      </div>
    </div>,
    document.body
  );
}
