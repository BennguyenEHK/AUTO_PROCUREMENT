import { NextResponse } from "next/server";
import { query } from "@/lib/db/client";
import { readSignupState } from "@/lib/signup/state";

export async function GET() {
  try {
    const state = await readSignupState();
    if (!state.signup || !state.company_id) {
      return NextResponse.json(
        { success: false, error: "Signup is required before RFQ records can be loaded." },
        { status: 400 }
      );
    }
    const companyId = state.company_id;
    const rows = await query(
      `select rfq_id, rfq_reference, subject, current_stage, stage_status, analysis_status, updated_at, created_at
       from rfq_analysis
       where company_id = $1
       order by coalesce(updated_at, created_at) desc
       limit 50`,
      [companyId]
    );
    return NextResponse.json({ success: true, rfqs: rows });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to load RFQs." },
      { status: 500 }
    );
  }
}
