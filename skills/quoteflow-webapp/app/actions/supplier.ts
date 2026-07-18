"use server";

import { tableColumns, updateReturning } from "@/lib/db/client";
import { readSignupState } from "@/lib/signup/state";

export type SupplierDecisionResult = { success: true } | { success: false; error: string };

async function supplierDecision(
  supplierStatusId: number,
  update: Record<string, unknown>
): Promise<SupplierDecisionResult> {
  try {
    const signup = await readSignupState();
    if (!signup.signup || !signup.company_id || !signup.user_id) {
      return { success: false, error: "Signup is required before supplier decisions can be saved." };
    }
    const id = Number(supplierStatusId);
    if (!Number.isInteger(id) || id <= 0) return { success: false, error: "A valid supplier row is required." };
    const columns = await tableColumns("supplier_item_status");
    for (const key of Object.keys(update)) {
      if (!columns.has(key)) {
        return { success: false, error: "Supplier decision fields are not available yet. Apply the QuoteFlow database migration first." };
      }
    }
    const result = await updateReturning("supplier_item_status", update, {
      id,
      company_id: signup.company_id,
      user_id: signup.user_id
    });
    return result ? { success: true } : { success: false, error: "Supplier row was not found for the signed-in workspace." };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Supplier decision could not be saved." };
  }
}

export async function setSupplierPreferred(supplierStatusId: number, isPreferred: boolean) {
  return supplierDecision(supplierStatusId, { is_preferred: isPreferred });
}

export async function hideSupplierFromWorkboard(supplierStatusId: number) {
  return supplierDecision(supplierStatusId, { is_hidden: true, hidden_at: new Date().toISOString() });
}
