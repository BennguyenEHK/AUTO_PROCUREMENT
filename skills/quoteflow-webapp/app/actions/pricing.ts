"use server";

import { insertReturning, one, query, updateReturning } from "@/lib/db/client";
import { calculatePricing } from "@/lib/services/pricing/pricing-calculator";
import { readSignupState } from "@/lib/signup/state";
import type { QuotationItem } from "@/types/documents";
import type { Currency, PricingResponse, PricingVariable, SupplierCandidate, SupplierSelection } from "@/types/pricing";

type PricingItem = QuotationItem & {
  supplier_candidates: SupplierCandidate[];
  selected_supplier_status_id: number | null;
};

export interface SavePricingInput {
  rfq_id: number;
  variables: PricingVariable[];
  supplier_selections: SupplierSelection[];
  exchange_currency: Currency;
}

export type SavePricingResult =
  | {
      success: true;
      quotation_id: number;
      calculated: PricingResponse;
      supplier_selections: SupplierSelection[];
    }
  | { success: false; error: string };

function numeric(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isSelectedSupplierStatus(status: unknown): boolean {
  const value = String(status ?? "").trim().toLowerCase();
  return ["selected", "approved", "accepted", "chosen", "final", "final_selected"].some((token) => value.includes(token));
}

function selectedSupplierStatusIds(value: unknown): Map<number, number> {
  const selections = Array.isArray(value) ? value : [];
  const result = new Map<number, number>();
  for (const selection of selections) {
    if (!selection || typeof selection !== "object") continue;
    const record = selection as Partial<SupplierSelection>;
    const itemId = Number(record.item_id);
    const supplierStatusId = Number(record.supplier_status_id);
    if (Number.isFinite(itemId) && itemId > 0 && Number.isFinite(supplierStatusId) && supplierStatusId > 0) {
      result.set(itemId, supplierStatusId);
    }
  }
  return result;
}

function selectedCandidate(item: PricingItem, requestedId?: number): SupplierCandidate | null {
  if (requestedId != null) {
    return item.supplier_candidates.find((candidate) => candidate.supplier_status_id === requestedId) ?? null;
  }
  return item.supplier_candidates.find((candidate) => candidate.is_selected) ?? null;
}

export async function savePricing(input: SavePricingInput): Promise<SavePricingResult> {
  try {
    const rfqId = Number(input.rfq_id);
    const variables = input.variables ?? [];
    const requestedSelections = selectedSupplierStatusIds(input.supplier_selections);
    if (!Number.isFinite(rfqId) || rfqId <= 0) {
      return { success: false, error: "rfq_id is required." };
    }

    const signup = await readSignupState();
    if (!signup.signup || !signup.company_id || !signup.user_id) {
      return { success: false, error: "Signup is required before pricing can be persisted." };
    }

    const items = await loadPricingItems(rfqId);
    const invalidSelections: number[] = [];
    const ambiguous: number[] = [];
    const missingPrice: number[] = [];
    const pricingItems: QuotationItem[] = [];

    for (const item of items) {
      const requestedId = requestedSelections.get(item.item_id);
      const candidate = selectedCandidate(item, requestedId);
      if (requestedId != null && !candidate) {
        invalidSelections.push(item.item_id);
        continue;
      }
      if (!candidate) {
        if (item.supplier_candidates.length > 1) ambiguous.push(item.item_id);
        else missingPrice.push(item.item_id);
        continue;
      }
      if (candidate.bidder_unit_price <= 0) {
        missingPrice.push(item.item_id);
        continue;
      }
      pricingItems.push({
        ...item,
        supplier_status_id: candidate.supplier_status_id,
        supplier_name: candidate.supplier_name,
        supplier_status: candidate.status,
        bidder_description: candidate.bidder_description,
        bidder_unit_price: candidate.bidder_unit_price,
        currency_code: candidate.currency_code,
        delivery_time: candidate.delivery_time
      });
    }

    if (invalidSelections.length > 0 || ambiguous.length > 0 || missingPrice.length > 0) {
      const errors = [];
      if (invalidSelections.length > 0) errors.push(`Selected supplier does not belong to item(s): ${invalidSelections.join(", ")}`);
      if (ambiguous.length > 0) errors.push(`Supplier basis must be selected for item(s): ${ambiguous.join(", ")}`);
      if (missingPrice.length > 0) errors.push(`A positive bidder unit price is required for item(s): ${missingPrice.join(", ")}`);
      return { success: false, error: errors.join(". ") };
    }

    const calculated = calculatePricing(pricingItems, variables);
    let quotation = await one("select * from quotations where rfq_id = $1 order by quotation_id desc limit 1", [rfqId]);
    if (!quotation) {
      quotation = await insertReturning("quotations", {
        rfq_id: rfqId,
        company_id: signup.company_id,
        user_id: signup.user_id,
        quotation_name: `RFQ ${rfqId} quotation`,
        quotation_status: "draft",
        version_number: 1,
        total_amount: calculated.total_amount,
        transfer_currency_code: input.exchange_currency,
        commercial_terms: "Validity, payment, warranty, and delivery terms to be confirmed."
      });
    } else {
      await updateReturning("quotations", {
        total_amount: calculated.total_amount,
        quotation_status: "draft",
        transfer_currency_code: input.exchange_currency
      }, { quotation_id: quotation.quotation_id });
    }

    const quotationId = Number(quotation.quotation_id);
    for (const [itemId, supplierStatusId] of requestedSelections) {
      await updateReturning("supplier_item_status", { status: "selected" }, { id: supplierStatusId, rfq_id: rfqId, item_id: itemId });
      await updateReturning("selected_offers", { supplier_item_status_id: supplierStatusId }, { rfq_id: rfqId, item_id: itemId });
    }
    for (const result of calculated.calculated_pricing) {
      const variable = variables.find((item) => Number(item.item_id) === Number(result.item_id));
      const payload = {
        item_id: result.item_id,
        quotation_id: quotationId,
        company_id: signup.company_id,
        user_id: signup.user_id,
        shipping_cost: variable?.shipping_cost ?? null,
        tax_rate: variable?.tax_rate ?? null,
        exchange_rate: variable?.exchange_rate ?? null,
        profit_rate: variable?.profit_rate ?? null,
        discount_rate: variable?.discount_rate ?? null,
        exchange_currency: input.exchange_currency,
        sales_unit_price: result.sales_unit_price,
        ext_price: result.ext_price,
        potential_profit: result.potential_profit
      };
      const updated = await updateReturning("quotation_pricing", payload, {
        quotation_id: quotationId,
        item_id: result.item_id
      });
      if (!updated) await insertReturning("quotation_pricing", payload);
    }

    return {
      success: true,
      quotation_id: quotationId,
      calculated,
      supplier_selections: pricingItems.map((item) => ({ item_id: item.item_id, supplier_status_id: item.supplier_status_id! }))
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to save pricing." };
  }
}

async function loadPricingItems(rfqId: number): Promise<PricingItem[]> {
  const rfqItems = await query("select * from rfq_items where rfq_id = $1 order by item_id", [rfqId]);
  const [supplierRows, selectedOffers] = await Promise.all([
    query(
      `select id, item_id, supplier_name, status, bidder_description, bidder_unit_price, currency_code, delivery_time
       from supplier_item_status
      where rfq_id = $1
      order by item_id, id`,
      [rfqId]
    ),
    query(
      `select item_id, supplier_item_status_id
         from selected_offers
        where rfq_id = $1
        order by updated_at desc nulls last, id desc`,
      [rfqId]
    )
  ]);
  const selectedOfferByItem = new Map<number, number>();
  for (const selectedOffer of selectedOffers) {
    const itemId = numeric(selectedOffer.item_id);
    const supplierStatusId = numeric(selectedOffer.supplier_item_status_id);
    if (itemId > 0 && supplierStatusId > 0 && !selectedOfferByItem.has(itemId)) {
      selectedOfferByItem.set(itemId, supplierStatusId);
    }
  }
  const suppliersByItem = new Map<number, Record<string, unknown>[]>();
  for (const supplier of supplierRows) {
    const itemId = numeric(supplier.item_id);
    const list = suppliersByItem.get(itemId) ?? [];
    list.push(supplier);
    suppliersByItem.set(itemId, list);
  }

  return rfqItems.map((row) => {
    const itemId = numeric(row.item_id);
    const candidates = suppliersByItem.get(itemId) ?? [];
    const statusSelected = candidates.filter((candidate) => isSelectedSupplierStatus(candidate.status));
    const storedSelected = candidates.find((candidate) => numeric(candidate.id) === selectedOfferByItem.get(itemId));
    const selected = statusSelected.length === 1 ? statusSelected[0] : storedSelected;
    const supplier = selected ?? candidates[0];
    const ambiguous = candidates.length > 1 && !selected;
    const candidateCount = candidates.length;
    return {
      item_id: itemId,
      company_description: String(row.company_description ?? ""),
      qty: numeric(row.qty),
      uom: String(row.uom ?? ""),
      supplier_status_id: supplier?.id == null ? null : numeric(supplier.id),
      supplier_name: supplier?.supplier_name == null ? null : String(supplier.supplier_name),
      supplier_status: supplier?.status == null ? null : String(supplier.status),
      supplier_candidate_count: candidateCount,
      selected_supplier_status_id: selected?.id == null ? null : numeric(selected.id),
      supplier_candidates: candidates.map((candidate) => ({
        supplier_status_id: numeric(candidate.id),
        supplier_name: candidate.supplier_name == null ? null : String(candidate.supplier_name),
        status: candidate.status == null ? null : String(candidate.status),
        bidder_description: String(candidate.bidder_description ?? ""),
        bidder_unit_price: numeric(candidate.bidder_unit_price),
        currency_code: String(candidate.currency_code ?? "USD"),
        delivery_time: candidate.delivery_time == null ? null : String(candidate.delivery_time),
        is_selected: candidate === selected
      })),
      supplier_basis_warning: ambiguous
        ? `${candidateCount} supplier candidates found. Mark one supplier row as selected/approved before saving pricing.`
        : null,
      bidder_description: String(supplier?.bidder_description ?? row.company_description ?? ""),
      bidder_unit_price: numeric(supplier?.bidder_unit_price),
      currency_code: String(supplier?.currency_code ?? "USD"),
      delivery_time: supplier?.delivery_time == null ? null : String(supplier.delivery_time)
    };
  });
}
