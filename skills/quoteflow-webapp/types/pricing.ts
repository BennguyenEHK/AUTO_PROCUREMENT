export interface PricingVariable {
  item_id: number;
  shipping_cost: number | null;
  tax_rate: number | null;
  exchange_rate: number | null;
  profit_rate: number | null;
  discount_rate: number | null;
}

export interface CalculatedPricing {
  item_id: number;
  sales_unit_price: number;
  ext_price: number;
  potential_profit: number;
  calculation_timestamp: string;
}

export interface SupplierCandidate {
  supplier_status_id: number;
  supplier_name: string | null;
  status: string | null;
  bidder_description: string;
  bidder_unit_price: number;
  currency_code: string;
  delivery_time: string | null;
  is_selected: boolean;
}

export interface SupplierSelection {
  item_id: number;
  supplier_status_id: number;
}

export interface PricingResponse {
  calculation_success: boolean;
  calculated_pricing: CalculatedPricing[];
  total_amount: number;
  total_profit: number;
  errors?: Array<{ item_id: number; error: string }>;
}

export type Currency = "VND" | "USD" | "EUR" | "JPY";

export interface CurrencyOption {
  code: Currency;
  name: string;
}

export const CURRENCIES: CurrencyOption[] = [
  { code: "VND", name: "Vietnamese Dong" },
  { code: "USD", name: "US Dollar" },
  { code: "EUR", name: "Euro" },
  { code: "JPY", name: "Japanese Yen" }
];

export type PricingVariableDefaults = {
  [K in keyof Omit<PricingVariable, "item_id">]: number;
};

export const DEFAULT_PRICING_VARIABLES: PricingVariableDefaults = {
  shipping_cost: 0,
  tax_rate: 1.1,
  exchange_rate: 1,
  profit_rate: 1.25,
  discount_rate: 0
};

export interface VariableFieldConfig {
  key: keyof Omit<PricingVariable, "item_id">;
  label: string;
  hint: string;
  format: "currency" | "rate" | "percent";
}

export const VARIABLE_FIELDS: VariableFieldConfig[] = [
  { key: "shipping_cost", label: "Shipping Cost", hint: "Cost added to supplier unit price", format: "currency" },
  { key: "tax_rate", label: "Tax Rate", hint: "Example: 1.1 for 10% tax", format: "rate" },
  { key: "exchange_rate", label: "Exchange Rate", hint: "Example: 24000 for USD to VND", format: "currency" },
  { key: "profit_rate", label: "Profit Rate", hint: "Example: 1.25 for 25% margin", format: "rate" },
  { key: "discount_rate", label: "Discount", hint: "Enter percent, for example 5", format: "percent" }
];

export interface PricingPanelContextType {
  quotationId: number | null;
  items: import("@/types/documents").QuotationItem[];
  variables: PricingVariable[];
  supplierSelections: SupplierSelection[];
  calculatedPricing: CalculatedPricing[];
  targetCurrency: Currency;
  isLoading: boolean;
  isCalculating: boolean;
  searchTerm: string;
  error: string | null;
  warning: string | null;
  dirty: boolean;
  draftTotals: { total_amount: number; total_profit: number };
  loadPricing: () => Promise<void>;
  updateVariable: (itemId: number, field: keyof Omit<PricingVariable, "item_id">, value: number | null) => void;
  bulkUpdateVariable: (itemIds: number[], field: keyof Omit<PricingVariable, "item_id">, value: number | null) => void;
  setSupplierSelection: (itemId: number, supplierStatusId: number) => void;
  setTargetCurrency: (currency: Currency) => void;
  setSearchTerm: (term: string) => void;
  applyPricing: () => Promise<void>;
  resetVariables: () => void;
  clearWarning: () => void;
}
