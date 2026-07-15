import { NextResponse } from "next/server";
import { createEventLog, getAccountState } from "@/lib/banking";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

export async function POST() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  }

  const state = await getAccountState(userId);
  const highestBalance = state.wallets.reduce((sum, wallet) => Math.max(sum, wallet.balance), 0);
  const recipient = `Scam Demo ${Math.floor(Math.random() * 1000)}`;

  await prisma.transaction.create({
    data: {
      userId,
      type: "send",
      amount: highestBalance * 0.8,
      currency: "USD",
      recipient,
      fraudFlagged: true,
      fraudStatus: "pending",
    },
  });
  await createEventLog(userId, 5, `Đã mô phỏng kịch bản lừa đảo với người nhận ${recipient}.`);
  return NextResponse.json({ ok: true, recipient });
}
