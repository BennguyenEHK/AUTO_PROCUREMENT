import type { PricingResponse, PricingVariable } from "@/types/pricing";
import type { QuotationItem } from "@/types/documents";

const DEFAULTS = {
  shipping_cost: 0,
  tax_rate: 1.1,
  exchange_rate: 1,
  profit_rate: 1.25,
  discount_rate: 0
};

function value(input: number | null | undefined, fallback: number): number {
  if (input == null) return fallback;
  return Number.isFinite(Number(input)) ? Number(input) : fallback;
}

function roundPrice(price: number): number {
  if (!Number.isFinite(price)) return 0;
  const rounded = Math.round(price / 1000) * 1000;
  if (price > 0 && rounded < 1000) return 1000;
  return Math.max(rounded, 0);
}

export function calculatePricing(items: QuotationItem[], variables: PricingVariable[]): PricingResponse {
  const variablesByItem = new Map(variables.map((item) => [item.item_id, item]));
  const calculated_pricing = [];
  const errors = [];
  let total_amount = 0;
  let total_profit = 0;

  for (const item of items) {
    const variable = variablesByItem.get(item.item_id);
    const qty = value(item.qty, 0);
    const unitPrice = value(item.bidder_unit_price, 0);
    if (qty <= 0 || unitPrice < 0) {
      errors.push({ item_id: item.item_id, error: "Quantity or supplier price is invalid." });
      continue;
    }

    const shipping = value(variable?.shipping_cost, DEFAULTS.shipping_cost);
    const tax = value(variable?.tax_rate, DEFAULTS.tax_rate);
    const exchange = value(variable?.exchange_rate, DEFAULTS.exchange_rate);
    const profit = value(variable?.profit_rate, DEFAULTS.profit_rate);
    const discount = value(variable?.discount_rate, DEFAULTS.discount_rate);

    const actualUnitPrice = (unitPrice + shipping) * tax * exchange;
    const profitUnitPrice = actualUnitPrice * profit;
    const salesUnitPrice = Math.max(Math.round(profitUnitPrice - profitUnitPrice * discount), 0);
    const extPrice = roundPrice(salesUnitPrice * qty);
    const potentialProfit = (Math.round(profitUnitPrice) - Math.round(actualUnitPrice)) * qty;

    calculated_pricing.push({
      item_id: item.item_id,
      sales_unit_price: salesUnitPrice,
      ext_price: extPrice,
      potential_profit: potentialProfit,
      calculation_timestamp: new Date().toISOString()
    });
    total_amount += extPrice;
    total_profit += potentialProfit;
  }

  return {
    calculation_success: errors.length === 0,
    calculated_pricing,
    total_amount: roundPrice(total_amount),
    total_profit,
    errors: errors.length ? errors : undefined
  };
}
