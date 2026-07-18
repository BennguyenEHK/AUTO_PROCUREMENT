import { NextResponse } from "next/server";
import { saveSignup } from "@/app/actions/signup";
import { readSignupState } from "@/lib/signup/state";

export async function GET() {
  return NextResponse.json(await readSignupState());
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await saveSignup({ company: body.company, user: body.user });
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Signup failed." },
      { status: 500 }
    );
  }
}
