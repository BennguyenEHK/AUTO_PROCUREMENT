import { NextResponse } from "next/server";

import { query } from "@/lib/db/client";
import { createFinalReportReadyNotification } from "@/lib/db/notifications";
import {
  buildFinalReportReadyNotification,
  isFinalReportType
} from "@/lib/services/notifications";
import { readSignupState } from "@/lib/signup/state";

export async function POST(request: Request) {
  try {
    const state = await readSignupState();
    if (!state.signup || !state.company_id || !state.user_id) {
      return NextResponse.json(
        { success: false, error: "Signup is required before notifications can be created." },
        { status: 400 }
      );
    }

    const body = await request.json();
    const rfqId = Number(body.rfq_id);
    if (!Number.isSafeInteger(rfqId) || rfqId <= 0 || !isFinalReportType(body.report_type)) {
      return NextResponse.json(
        { success: false, error: "A positive rfq_id and supported final report_type are required." },
        { status: 400 }
      );
    }

    const draft = buildFinalReportReadyNotification({
      rfq_id: rfqId,
      report_type: body.report_type,
      readiness: {
        state: String(body.readiness?.state ?? ""),
        is_ready: body.readiness?.is_ready === true
      },
      document_ready: body.document_ready === true,
      rfq_reference: typeof body.rfq_reference === "string" ? body.rfq_reference : null
    });
    if (!draft) {
      return NextResponse.json({ success: true, created: false, reason: "Report is still interim." });
    }

    const notification = await createFinalReportReadyNotification(
      query,
      { company_id: state.company_id, user_id: state.user_id },
      draft
    );
    return NextResponse.json({
      success: true,
      created: notification !== null,
      duplicate: notification === null,
      notification
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to create notification." },
      { status: 500 }
    );
  }
}
