"use client";

import { Globe } from "lucide-react";
import { CURRENCIES, type Currency } from "@/types/pricing";
import { usePricingPanel } from "./pricing-panel-provider";

export function CurrencySelector() {
  const { targetCurrency, setTargetCurrency } = usePricingPanel();
  return (
    <div className="pricing-soft-panel">
      <label className="section-label">Global Currency Setting</label>
      <div className="currency-row">
        <span className="icon-tile"><Globe size={16} /></span>
        <div>
          <label className="section-label">Target Currency</label>
          <select value={targetCurrency} onChange={(event) => setTargetCurrency(event.target.value as Currency)}>
            {CURRENCIES.map((currency) => <option key={currency.code} value={currency.code}>{currency.code} - {currency.name}</option>)}
          </select>
        </div>
      </div>
      <p className="muted">Applied pricing will be saved in {targetCurrency}.</p>
    </div>
  );
}
