"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { QuotationItem } from "@/types/documents";
import type { CalculatedPricing, Currency, PricingPanelContextType, PricingVariable, SupplierSelection } from "@/types/pricing";
import { DEFAULT_PRICING_VARIABLES } from "@/types/pricing";
import { currencyService } from "@/lib/services/pricing/currency-service";
import { savePricing } from "@/app/actions/pricing";

interface PricingPayload {
  success: boolean;
  items: QuotationItem[];
  variables: PricingVariable[];
  calculated_pricing?: CalculatedPricing[];
  quotation_id?: number | null;
  error?: string;
}

interface PricingPanelProviderProps {
  children: ReactNode;
  rfqId: number | null;
}

const PricingPanelContext = createContext<PricingPanelContextType | null>(null);

function emptyVariable(item_id: number): PricingVariable {
  return { item_id, shipping_cost: null, tax_rate: null, exchange_rate: null, profit_rate: null, discount_rate: null };
}

function n(value: unknown, fallback = 0) {
  if (value == null) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function roundPrice(price: number): number {
  if (!Number.isFinite(price)) return 0;
  const rounded = Math.round(price / 1000) * 1000;
  if (price > 0 && rounded < 1000) return 1000;
  return Math.max(rounded, 0);
}

function calculateDraft(items: QuotationItem[], variables: PricingVariable[]) {
  const map = new Map(variables.map((variable) => [variable.item_id, variable]));
  let total_amount = 0;
  let total_profit = 0;
  for (const item of items) {
    const variable = map.get(item.item_id) ?? emptyVariable(item.item_id);
    const actual =
      (n(item.bidder_unit_price) + n(variable.shipping_cost, DEFAULT_PRICING_VARIABLES.shipping_cost)) *
      n(variable.tax_rate, DEFAULT_PRICING_VARIABLES.tax_rate) *
      n(variable.exchange_rate, DEFAULT_PRICING_VARIABLES.exchange_rate);
    const profitUnit = actual * n(variable.profit_rate, DEFAULT_PRICING_VARIABLES.profit_rate);
    const salesUnit = Math.max(Math.round(profitUnit - profitUnit * n(variable.discount_rate, DEFAULT_PRICING_VARIABLES.discount_rate)), 0);
    const ext = roundPrice(salesUnit * n(item.qty));
    const profit = (Math.round(profitUnit) - Math.round(actual)) * n(item.qty);
    total_amount += ext;
    total_profit += profit;
  }
  return { total_amount: roundPrice(total_amount), total_profit };
}

export function PricingPanelProvider({ children, rfqId }: PricingPanelProviderProps) {
  const [quotationId, setQuotationId] = useState<number | null>(null);
  const [items, setItems] = useState<QuotationItem[]>([]);
  const [variables, setVariables] = useState<PricingVariable[]>([]);
  const [appliedVariables, setAppliedVariables] = useState<PricingVariable[]>([]);
  const [supplierSelections, setSupplierSelections] = useState<SupplierSelection[]>([]);
  const [calculatedPricing, setCalculatedPricing] = useState<CalculatedPricing[]>([]);
  const [targetCurrency, setTargetCurrencyState] = useState<Currency>("VND");
  const [isLoading, setIsLoading] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const draftTotals = useMemo(() => calculateDraft(items, variables), [items, variables]);

  useEffect(() => {
    setTargetCurrencyState(currencyService.loadTargetCurrency());
  }, []);

  const loadPricing = useCallback(async () => {
    if (!rfqId) {
      setItems([]);
      setVariables([]);
      setAppliedVariables([]);
      setSupplierSelections([]);
      setCalculatedPricing([]);
      setQuotationId(null);
      setDirty(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/pricing?rfqId=${rfqId}`, { cache: "no-store" });
      const payload = (await response.json()) as PricingPayload;
      if (!payload.success) throw new Error(payload.error || "Could not load pricing.");
      const stored = new Map(payload.variables.map((variable) => [variable.item_id, variable]));
      const nextVariables = payload.items.map((item) => ({ ...emptyVariable(item.item_id), ...(stored.get(item.item_id) ?? {}) }));
      setItems(payload.items);
      setVariables(nextVariables);
      setAppliedVariables(nextVariables);
      setSupplierSelections(payload.items.flatMap((item) => item.selected_supplier_status_id
        ? [{ item_id: item.item_id, supplier_status_id: item.selected_supplier_status_id }]
        : []));
      setCalculatedPricing(payload.calculated_pricing ?? []);
      setQuotationId(payload.quotation_id ?? null);
      setDirty(false);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load pricing.");
    } finally {
      setIsLoading(false);
    }
  }, [rfqId]);

  useEffect(() => {
    loadPricing();
  }, [loadPricing]);

  const updateVariable = useCallback((itemId: number, field: keyof Omit<PricingVariable, "item_id">, value: number | null) => {
    setVariables((current) => current.map((variable) => variable.item_id === itemId ? { ...variable, [field]: value } : variable));
    setDirty(true);
  }, []);

  const bulkUpdateVariable = useCallback((itemIds: number[], field: keyof Omit<PricingVariable, "item_id">, value: number | null) => {
    setVariables((current) => current.map((variable) => itemIds.includes(variable.item_id) ? { ...variable, [field]: value } : variable));
    setDirty(true);
  }, []);

  const setSupplierSelection = useCallback((itemId: number, supplierStatusId: number) => {
    setItems((current) => current.map((item) => {
      if (item.item_id !== itemId) return item;
      const supplier = item.supplier_candidates?.find((candidate) => candidate.supplier_status_id === supplierStatusId);
      if (!supplier) return item;
      return {
        ...item,
        supplier_status_id: supplier.supplier_status_id,
        supplier_name: supplier.supplier_name,
        supplier_status: supplier.status,
        bidder_description: supplier.bidder_description,
        bidder_unit_price: supplier.bidder_unit_price,
        currency_code: supplier.currency_code,
        delivery_time: supplier.delivery_time,
        supplier_basis_warning: supplier.bidder_unit_price > 0 ? null : "Selected supplier requires a positive bidder unit price before pricing can be saved."
      };
    }));
    setSupplierSelections((current) => [
      ...current.filter((selection) => selection.item_id !== itemId),
      { item_id: itemId, supplier_status_id: supplierStatusId }
    ]);
    setDirty(true);
  }, []);

  const setTargetCurrency = useCallback((currency: Currency) => {
    setTargetCurrencyState(currency);
    currencyService.saveTargetCurrency(currency);
  }, []);

  const applyPricing = useCallback(async () => {
    if (!rfqId || items.length === 0) {
      setError("Data not available yet");
      return;
    }
    setIsCalculating(true);
    setError(null);
    setWarning(null);
    try {
      const payload = await savePricing({
        rfq_id: rfqId,
        variables,
        supplier_selections: supplierSelections,
        exchange_currency: targetCurrency
      });
      if (!payload.success) throw new Error(payload.error || "Pricing save failed.");
      setQuotationId(payload.quotation_id ?? quotationId);
      setCalculatedPricing(payload.calculated.calculated_pricing ?? []);
      setAppliedVariables(variables);
      setSupplierSelections(payload.supplier_selections ?? supplierSelections);
      setDirty(false);
      if (Array.isArray(payload.calculated.errors) && payload.calculated.errors.length > 0) {
        setWarning(`Calculated with ${payload.calculated.errors.length} partial error(s). First: ${payload.calculated.errors[0].error}`);
      }
    } catch (applyError) {
      setError(applyError instanceof Error ? applyError.message : "Pricing save failed.");
    } finally {
      setIsCalculating(false);
    }
  }, [items.length, quotationId, rfqId, supplierSelections, targetCurrency, variables]);

  const resetVariables = useCallback(() => {
    setVariables(appliedVariables);
    setDirty(false);
  }, [appliedVariables]);

  const contextValue: PricingPanelContextType = {
    quotationId,
    items,
    variables,
    supplierSelections,
    calculatedPricing,
    targetCurrency,
    isLoading,
    isCalculating,
    searchTerm,
    error,
    warning,
    dirty,
    draftTotals,
    loadPricing,
    updateVariable,
    bulkUpdateVariable,
    setSupplierSelection,
    setTargetCurrency,
    setSearchTerm,
    applyPricing,
    resetVariables,
    clearWarning: () => setWarning(null)
  };

  return <PricingPanelContext.Provider value={contextValue}>{children}</PricingPanelContext.Provider>;
}

export function usePricingPanel(): PricingPanelContextType {
  const context = useContext(PricingPanelContext);
  if (!context) throw new Error("usePricingPanel must be used within PricingPanelProvider");
  return context;
}
