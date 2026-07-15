import { NextResponse } from "next/server";
import { createEventLog, getAccountState, toUsd } from "@/lib/banking";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

const SCAM_RECIPIENTS = [
  "Nguyễn Văn A (số lạ)",
  "Người tự xưng nhân viên ngân hàng",
  "Tài khoản chưa xác minh danh tính",
];

export async function POST() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  }

  const state = await getAccountState(userId);
  const highestBalanceUsd = state.wallets.reduce((max, wallet) => Math.max(max, toUsd(wallet.balance, wallet.currency)), 0);
  const recipient = SCAM_RECIPIENTS[Math.floor(Math.random() * SCAM_RECIPIENTS.length)];

  await prisma.transaction.create({
    data: {
      userId,
      type: "send",
      amount: highestBalanceUsd * 0.8,
      currency: "USD",
      recipient,
      fraudFlagged: true,
      fraudStatus: "pending",
    },
  });
  await createEventLog(userId, 5, `Đã mô phỏng kịch bản lừa đảo với người nhận ${recipient}.`);
  return NextResponse.json({ ok: true, recipient });
}
