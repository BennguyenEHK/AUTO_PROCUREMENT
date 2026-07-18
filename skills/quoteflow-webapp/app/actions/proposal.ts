"use server";

import { insertReturning, tableColumns, updateReturning } from "@/lib/db/client";
import { readSignupState } from "@/lib/signup/state";
import type { ProposalSaveInput, ProposalSaveResult } from "@/types/proposal";

function numberValue(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function saveProposal(input: ProposalSaveInput): Promise<ProposalSaveResult> {
  try {
    const rfqId = Number(input.rfq_id);
    const quotationId = input.quotation_id == null ? null : Number(input.quotation_id);
    if (!Number.isFinite(rfqId) || rfqId <= 0) {
      return { success: false, error: "rfq_id is required." };
    }
    if (!quotationId) {
      return { success: false, error: "A saved quotation is required before proposal edits can be saved." };
    }
    if (input.layout) {
      try {
        JSON.stringify(input.layout);
      } catch {
        return { success: false, error: "Proposal layout must be serializable." };
      }
    }

    const signup = await readSignupState();
    if (!signup.signup || !signup.company_id || !signup.user_id) {
      return { success: false, error: "Signup is required before proposal edits can be saved." };
    }

    for (const row of input.rows ?? []) {
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

    const quotationColumns = await tableColumns("quotations");
    const layoutPersisted = !input.layout || quotationColumns.has("proposal_layout");
    await updateReturning("quotations", {
      total_amount: numberValue(input.total_amount),
      commercial_terms: input.commercial_terms,
      proposal_layout: input.layout && layoutPersisted ? input.layout : undefined
    }, { quotation_id: quotationId });

    return input.layout && !layoutPersisted
      ? {
        success: true,
        layout_persisted: false,
        warning: "RFQ edits were saved. Custom columns and manual rows remain in this editor session because quotations.proposal_layout (JSON/JSONB) is not available."
      }
      : { success: true, layout_persisted: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Proposal save failed." };
  }
}
