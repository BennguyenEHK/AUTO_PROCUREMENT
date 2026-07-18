"use client";

import { useMemo, useState } from "react";
import type { MouseEvent } from "react";
import type { PricingVariable } from "@/types/pricing";
import { usePricingPanel } from "./pricing-panel-provider";
import { BulkUpdatePopover } from "./bulk-update-popover";
import { PricingItemCard } from "./pricing-item-card";

type VariableField = keyof Omit<PricingVariable, "item_id">;

function seedValue(field: VariableField, value: number | null): string {
  if (value == null) return "";
  return field === "discount_rate" ? String(value * 100) : String(value);
}

export function PricingItemList() {
  const { items, variables, searchTerm } = usePricingPanel();
  const [bulkState, setBulkState] = useState<{
    field: VariableField;
    value: string;
    position: { x: number; y: number };
  } | null>(null);

  const variablesMap = useMemo(() => new Map(variables.map((variable) => [variable.item_id, variable])), [variables]);
  const filteredItems = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return items;
    return items.filter((item) =>
      `${item.item_id} ${item.company_description} ${item.bidder_description} ${item.supplier_name ?? ""} ${item.currency_code}`
        .toLowerCase()
        .includes(term)
    );
  }, [items, searchTerm]);

  function onContextMenu(event: MouseEvent<HTMLDivElement>) {
    const input = (event.target as HTMLElement).closest("input[data-field]") as HTMLInputElement | null;
    if (!input) return;
    event.preventDefault();
    input.blur();
    const card = input.closest("[data-item-id]") as HTMLElement | null;
    const itemId = Number(card?.dataset.itemId);
    const field = input.dataset.field as VariableField;
    const variable = variablesMap.get(itemId);
    setBulkState({
      field,
      value: seedValue(field, variable?.[field] ?? null),
      position: { x: event.clientX, y: event.clientY }
    });
  }

  if (filteredItems.length === 0) {
    return <div className="empty-mini"><p>Data not available yet</p></div>;
  }

  return (
    <div className="items-scroll" onContextMenu={onContextMenu}>
      {filteredItems.map((item) => {
        const variablesForItem = variablesMap.get(item.item_id) ?? {
          item_id: item.item_id,
          shipping_cost: null,
          tax_rate: null,
          exchange_rate: null,
          profit_rate: null,
          discount_rate: null
        };
        return <PricingItemCard key={item.item_id} item={item} variables={variablesForItem} />;
      })}
      {bulkState ? (
        <BulkUpdatePopover
          field={bulkState.field}
          items={filteredItems}
          initialValue={bulkState.value}
          position={bulkState.position}
          onClose={() => setBulkState(null)}
        />
      ) : null}
    </div>
  );
}
