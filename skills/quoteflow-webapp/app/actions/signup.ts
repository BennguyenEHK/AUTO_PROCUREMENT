"use server";

import { insertReturning, tableColumns } from "@/lib/db/client";
import { writeSignupState, type SignupState } from "@/lib/signup/state";

export interface SignupInput {
  company: {
    company_name: string;
    company_number: string;
    company_address: string;
    company_fax: string;
    company_email: string;
  };
  user: {
    username: string;
    full_name: string;
    email: string;
    user_role: string;
  };
}

export type SignupResult =
  | { success: true; state: SignupState }
  | { success: false; error: string };

export async function saveSignup(input: SignupInput): Promise<SignupResult> {
  try {
    const company = input.company ?? {};
    const user = input.user ?? {};
    const username = typeof user.username === "string" ? user.username.trim() : "";
    if (!username) {
      return { success: false, error: "Username is required." };
    }

    const companyColumns = await tableColumns("user_company");
    const companyPayload: Record<string, unknown> = {};
    if (companyColumns.has("company_name")) companyPayload.company_name = company.company_name ?? "";
    if (companyColumns.has("company_number")) companyPayload.company_number = company.company_number ?? null;
    if (companyColumns.has("company_address")) companyPayload.company_address = company.company_address ?? null;
    if (companyColumns.has("company_fax")) companyPayload.company_fax = company.company_fax ?? null;
    if (companyColumns.has("company_email")) companyPayload.company_email = company.company_email ?? null;

    const insertedCompany = await insertReturning("user_company", companyPayload);
    const companyId = Number(insertedCompany.company_id);
    if (!Number.isSafeInteger(companyId) || companyId <= 0) {
      throw new Error("Signup did not return a valid company_id.");
    }

    const userColumns = await tableColumns("user_info");
    const userPayload: Record<string, unknown> = {};
    if (userColumns.has("company_id")) userPayload.company_id = companyId;
    if (userColumns.has("username")) userPayload.username = username;
    if (userColumns.has("full_name")) userPayload.full_name = user.full_name ?? null;
    if (userColumns.has("email")) userPayload.email = user.email ?? null;
    if (userColumns.has("user_role")) userPayload.user_role = user.user_role ?? "user";
    if (userColumns.has("user_status")) userPayload.user_status = "active";

    const insertedUser = await insertReturning("user_info", userPayload);
    const userId = Number(insertedUser.user_id);
    if (!Number.isSafeInteger(userId) || userId <= 0) {
      throw new Error("Signup did not return a valid user_id.");
    }
    const state: SignupState = {
      signup: true,
      user_id: userId,
      company_id: companyId,
      username,
      company_name: String(company.company_name ?? "")
    };
    await writeSignupState(state);

    return { success: true, state };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Signup failed." };
  }
}
