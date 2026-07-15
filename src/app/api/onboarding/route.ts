import { NextResponse } from "next/server";
import { createEventLog, toPublicUser, updateUserKyc } from "@/lib/banking";
import { getSessionUserId } from "@/lib/session";

export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  }

  const { name, riskProfile } = await request.json();
  const updated = await updateUserKyc(userId, name, riskProfile);
  await createEventLog(userId, 1, `Khách hàng đã hoàn tất onboarding và chọn khẩu vị rủi ro ${riskProfile}.`);

  return NextResponse.json({ user: toPublicUser(updated) });
}
