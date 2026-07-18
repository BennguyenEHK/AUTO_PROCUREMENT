import type { Currency } from "@/types/pricing";

const KEY = "quoteflow.targetCurrency";

export const currencyService = {
  loadTargetCurrency(): Currency {
    if (typeof window === "undefined") return "VND";
    const saved = window.localStorage.getItem(KEY);
    return saved === "USD" || saved === "EUR" || saved === "JPY" || saved === "VND" ? saved : "VND";
  },
  saveTargetCurrency(currency: Currency): void {
    if (typeof window !== "undefined") window.localStorage.setItem(KEY, currency);
  }
};
