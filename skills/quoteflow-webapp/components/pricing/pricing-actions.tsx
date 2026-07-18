"use client";

import { Calculator, Loader2, RotateCcw } from "lucide-react";
import { usePricingPanel } from "./pricing-panel-provider";

export function PricingActions() {
  const { applyPricing, resetVariables, isCalculating, items, variables, dirty } = usePricingPanel();
  const canApply = items.length > 0 && variables.length > 0 && !isCalculating;
  return (
    <div className="pricing-actions">
      <button className="secondary" onClick={resetVariables} disabled={isCalculating || !dirty}>
        <RotateCcw size={16} /> Reset
      </button>
      <button className="primary" onClick={applyPricing} disabled={!canApply}>
        {isCalculating ? <Loader2 size={16} className="spin" /> : <Calculator size={16} />}
        {isCalculating ? "Calculating..." : "Apply"}
      </button>
    </div>
  );
}
