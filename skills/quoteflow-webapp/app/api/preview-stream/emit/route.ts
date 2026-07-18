import { NextResponse } from "next/server";
import { emitPreviewEvent } from "@/lib/event-bus";

export async function POST(request: Request) {
  const event = await request.json();
  emitPreviewEvent(event);
  return NextResponse.json({ success: true });
}
