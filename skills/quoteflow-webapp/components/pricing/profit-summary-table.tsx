"use client";

import { usePricingPanel } from "./pricing-panel-provider";
import { formatCurrency } from "@/lib/services/pricing/validation";

export function ProfitSummaryTable() {
  const { items, calculatedPricing, draftTotals } = usePricingPanel();
  const itemsMap = new Map(items.map((item) => [item.item_id, item]));
  const totalProfit = calculatedPricing.reduce((sum, row) => sum + row.potential_profit, 0);
  if (calculatedPricing.length === 0) {
    return (
      <div className="pricing-soft-panel">
        <h4>Potential Profit</h4>
        <div className="empty-mini">
          <p>No calculations yet</p>
          <span>Click Apply to calculate pricing</span>
        </div>
        <div className="summary-line"><span>Draft Total</span><strong>{formatCurrency(draftTotals.total_amount)}</strong></div>
      </div>
    );
  }
  return (
    <div className="pricing-soft-panel">
      <h4>Potential Profit (VND)</h4>
      <div className="profit-table-wrap">
        <table>
          <thead><tr><th>Item</th><th>Qty</th><th>Profit</th></tr></thead>
          <tbody>
            {calculatedPricing.map((row) => (
              <tr key={row.item_id}>
                <td>{itemsMap.get(row.item_id)?.bidder_description || `Item ${row.item_id}`}</td>
                <td>{itemsMap.get(row.item_id)?.qty ?? 0}</td>
                <td className="number">{formatCurrency(row.potential_profit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="summary-line"><span>Total Profit</span><strong>{formatCurrency(totalProfit)}</strong></div>
      <div className="summary-line"><span>Draft Total</span><strong>{formatCurrency(draftTotals.total_amount)}</strong></div>
    </div>
  );
}
