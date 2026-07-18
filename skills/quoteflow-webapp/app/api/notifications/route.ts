import { NextResponse } from "next/server";

import { query } from "@/lib/db/client";
import { listNotifications } from "@/lib/db/notifications";
import { readSignupState } from "@/lib/signup/state";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const scope = await activeScope();
    if (!scope) {
      return NextResponse.json(
        { success: false, error: "Signup is required before notifications can be loaded." },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const rfqIdValue = searchParams.get("rfqId");
    const rfqId = rfqIdValue == null ? undefined : Number(rfqIdValue);
    if (rfqId !== undefined && (!Number.isSafeInteger(rfqId) || rfqId <= 0)) {
      return NextResponse.json({ success: false, error: "rfqId must be a positive integer." }, { status: 400 });
    }

    const result = await listNotifications(query, scope, {
      rfq_id: rfqId,
      unread_only: searchParams.get("unreadOnly") === "true",
      limit: Number(searchParams.get("limit") ?? 50)
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to load notifications." },
      { status: 500 }
    );
  }
}

async function activeScope(): Promise<{ company_id: number; user_id: number } | null> {
  const state = await readSignupState();
  if (!state.signup || !state.company_id || !state.user_id) return null;
  return { company_id: state.company_id, user_id: state.user_id };
}
