"use client";

import { Search, X } from "lucide-react";
import { usePricingPanel } from "./pricing-panel-provider";

export function ItemSearch() {
  const { items, searchTerm, setSearchTerm } = usePricingPanel();
  const filtered = searchTerm
    ? items.filter((item) => `${item.item_id} ${item.company_description} ${item.bidder_description}`.toLowerCase().includes(searchTerm.toLowerCase())).length
    : items.length;
  return (
    <div className="pricing-soft-panel">
      <div className="search-input-wrap">
        <Search size={16} />
        <input
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Escape") setSearchTerm(""); }}
          placeholder="Search items by keyword..."
        />
        {searchTerm ? <button aria-label="Clear search" onClick={() => setSearchTerm("")}><X size={14} /></button> : null}
      </div>
      <p className="muted">{searchTerm ? `${filtered} of ${items.length} items match "${searchTerm}"` : `${items.length} items available`}</p>
    </div>
  );
}
