import { NextResponse } from "next/server";
import { buildAccountPayload, getAccountState } from "@/lib/banking";
import { getSessionUserId } from "@/lib/session";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  }

  const state = await getAccountState(userId);
  return NextResponse.json({ account: buildAccountPayload(state) });
}
