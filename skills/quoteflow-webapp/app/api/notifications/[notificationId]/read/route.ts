import { NextResponse } from "next/server";

import { query } from "@/lib/db/client";
import { markNotificationRead } from "@/lib/db/notifications";
import { readSignupState } from "@/lib/signup/state";

export async function PATCH(
  _request: Request,
  context: { params: Promise<{ notificationId: string }> }
) {
  try {
    const state = await readSignupState();
    if (!state.signup || !state.company_id || !state.user_id) {
      return NextResponse.json(
        { success: false, error: "Signup is required before notifications can be updated." },
        { status: 400 }
      );
    }

    const { notificationId: rawNotificationId } = await context.params;
    const notificationId = Number(rawNotificationId);
    if (!Number.isSafeInteger(notificationId) || notificationId <= 0) {
      return NextResponse.json(
        { success: false, error: "notificationId must be a positive integer." },
        { status: 400 }
      );
    }

    const notification = await markNotificationRead(
      query,
      { company_id: state.company_id, user_id: state.user_id },
      notificationId
    );
    if (!notification) {
      return NextResponse.json({ success: false, error: "Notification not found." }, { status: 404 });
    }
    return NextResponse.json({ success: true, notification });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to update notification." },
      { status: 500 }
    );
  }
}
