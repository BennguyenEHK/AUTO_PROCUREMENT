import { NextResponse } from "next/server";
import { insertReturning, one, query, tableColumns, updateReturning } from "@/lib/db/client";
import { readSignupState } from "@/lib/signup/state";
import type { ProposalDocument, ProposalItem, ProposalLayoutConfig, ProposalSaveRow } from "@/types/proposal";

function numberValue(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function text(value: unknown, fallback = ""): string {
  if (value == null) return fallback;
  const rendered = String(value);
  return rendered.trim() ? rendered : fallback;
}

function isSelectedSupplierStatus(status: unknown): boolean {
  const value = String(status ?? "").trim().toLowerCase();
  return ["selected", "approved", "accepted", "chosen", "final", "final_selected"].some((token) => value.includes(token));
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rfqId = Number(searchParams.get("rfqId"));
    if (!Number.isFinite(rfqId) || rfqId <= 0) {
      return NextResponse.json({ success: false, error: "rfqId is required." }, { status: 400 });
    }

    const document = await buildProposalDocument(rfqId);
    return NextResponse.json({ success: true, document });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to load proposal." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rfqId = Number(body.rfq_id);
    const quotationId = body.quotation_id == null ? null : Number(body.quotation_id);
    const rows = (body.rows ?? []) as ProposalSaveRow[];
    const totalAmount = numberValue(body.total_amount);
    const commercialTerms = body.commercial_terms == null ? undefined : String(body.commercial_terms);

    if (!Number.isFinite(rfqId) || rfqId <= 0) {
      return NextResponse.json({ success: false, error: "rfq_id is required." }, { status: 400 });
    }
    if (!quotationId) {
      return NextResponse.json({ success: false, error: "A saved quotation is required before proposal edits can be saved." }, { status: 400 });
    }

    const signup = await readSignupState();
    if (!signup.signup || !signup.company_id || !signup.user_id) {
      return NextResponse.json({ success: false, error: "Signup is required before proposal edits can be saved." }, { status: 400 });
    }

    for (const row of rows) {
      const itemId = Number(row.item_id);
      if (!Number.isFinite(itemId) || itemId <= 0) continue;
      await updateReturning("rfq_items", {
        company_description: row.company_description,
        qty: numberValue(row.qty),
        uom: row.uom
      }, { rfq_id: rfqId, item_id: itemId });

      if (row.supplier_status_id) {
        await updateReturning("supplier_item_status", {
          bidder_description: row.bidder_description,
          delivery_time: row.delivery_time ?? null
        }, { id: row.supplier_status_id });
      }

      const pricingPayload = {
        item_id: itemId,
        quotation_id: quotationId,
        company_id: signup.company_id,
        user_id: signup.user_id,
        sales_unit_price: row.sales_unit_price == null ? null : numberValue(row.sales_unit_price),
        ext_price: row.ext_price == null ? null : numberValue(row.ext_price)
      };
      const updated = await updateReturning("quotation_pricing", pricingPayload, {
        quotation_id: quotationId,
        item_id: itemId
      });
      if (!updated && (row.sales_unit_price != null || row.ext_price != null)) {
        await insertReturning("quotation_pricing", pricingPayload);
      }
    }

    await updateReturning("quotations", {
      total_amount: totalAmount,
      commercial_terms: commercialTerms
    }, { quotation_id: quotationId });

    return NextResponse.json({ success: true, document: await buildProposalDocument(rfqId) });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to save proposal." },
      { status: 500 }
    );
  }
}

async function buildProposalDocument(rfqId: number): Promise<ProposalDocument> {
  const rfq = await one("select * from rfq_analysis where rfq_id = $1", [rfqId]);
  const quotation = await one("select * from quotations where rfq_id = $1 order by quotation_id desc limit 1", [rfqId]);
  const customer = await one("select * from customers where rfq_id = $1 order by customer_id desc limit 1", [rfqId]);
  const signup = await readSignupState();
  const seller = signup.company_id
    ? await one("select * from user_company where company_id = $1", [signup.company_id])
    : null;

  const selectedOfferColumns = await tableColumns("selected_offers");
  const hasSelectedOffers = selectedOfferColumns.has("rfq_id") && selectedOfferColumns.has("item_id");
  const [rfqItems, supplierRows, pricingRows, selectedOffers] = await Promise.all([
    query("select item_id, company_description, qty, uom from rfq_items where rfq_id = $1 order by item_id", [rfqId]),
    query("select id, item_id, status, bidder_description, delivery_time from supplier_item_status where rfq_id = $1 order by item_id, id", [rfqId]),
    query("select item_id, sales_unit_price, ext_price from quotation_pricing where quotation_id = $1", [quotation?.quotation_id ?? null]),
    hasSelectedOffers
      ? query("select item_id, supplier_item_status_id from selected_offers where rfq_id = $1 order by updated_at desc nulls last, id desc", [rfqId])
      : Promise.resolve([])
  ]);
  const selectedOfferByItem = new Map<number, number>();
  for (const selectedOffer of selectedOffers) {
    const itemId = numberValue(selectedOffer.item_id);
    const supplierStatusId = numberValue(selectedOffer.supplier_item_status_id);
    if (itemId > 0 && supplierStatusId > 0 && !selectedOfferByItem.has(itemId)) selectedOfferByItem.set(itemId, supplierStatusId);
  }
  const suppliersByItem = new Map<number, Record<string, unknown>[]>();
  for (const supplier of supplierRows) {
    const itemId = numberValue(supplier.item_id);
    const candidates = suppliersByItem.get(itemId) ?? [];
    candidates.push(supplier);
    suppliersByItem.set(itemId, candidates);
  }
  const pricingByItem = new Map(pricingRows.map((row) => [numberValue(row.item_id), row]));
  const items: ProposalItem[] = [];
  for (const row of rfqItems) {
    const itemId = numberValue(row.item_id);
    const candidates = suppliersByItem.get(itemId) ?? [];
    const statusSelected = candidates.filter((candidate) => isSelectedSupplierStatus(candidate.status));
    const storedSelected = candidates.find((candidate) => numberValue(candidate.id) === selectedOfferByItem.get(itemId));
    const supplier = statusSelected.length === 1 ? statusSelected[0] : storedSelected ?? null;
    const pricing = pricingByItem.get(itemId);
    items.push({
      item_id: itemId,
      supplier_status_id: supplier?.id == null ? null : numberValue(supplier.id),
      company_requirement: {
        company_description: text(row.company_description),
        qty: numberValue(row.qty),
        uom: text(row.uom)
      },
      bidder_proposal: {
        bidder_description: supplier ? text(supplier.bidder_description) : "Supplier selection required before proposal can be generated.",
        delivery_time: supplier?.delivery_time == null ? null : text(supplier.delivery_time)
      },
      sales_unit_price: pricing?.sales_unit_price == null ? null : numberValue(pricing.sales_unit_price),
      ext_price: pricing?.ext_price == null ? null : numberValue(pricing.ext_price)
    });
  }

  return {
    rfq_id: rfqId,
    quotation_id: quotation?.quotation_id == null ? null : numberValue(quotation.quotation_id),
    rfq_reference: text(rfq?.rfq_reference),
    quotation_name: text(quotation?.quotation_name, `RFQ ${rfqId} quotation`),
    quotation_date: new Date().toISOString().slice(0, 10),
    page_number: "1",
    currency: text(quotation?.transfer_currency_code, "VND"),
    total_amount: numberValue(quotation?.total_amount),
    commercial_terms: text(quotation?.commercial_terms, "Validity, payment terms, delivery, and exclusions to be confirmed."),
    proposal_layout: (quotation?.proposal_layout ?? null) as ProposalLayoutConfig | null,
    seller_info: {
      company_name: text(seller?.company_name),
      address: text(seller?.company_address),
      tel: text(seller?.company_number),
      fax_number: text(seller?.company_fax)
    },
    customer_info: {
      company_name: text(customer?.company_name),
      customer_address: text(customer?.customer_address),
      tel: text(customer?.phone),
      fax_number: text(customer?.fax_number),
      attention_person: text(customer?.attention_person),
      carbon_copy_person: customer?.carbon_copy_person
    },
    quotation_items: items
  };
}
