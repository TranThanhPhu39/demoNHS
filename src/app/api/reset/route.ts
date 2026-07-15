import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createEventLog } from "@/lib/banking";
import { getSessionUserId } from "@/lib/session";

export async function POST() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  }

  await prisma.transaction.deleteMany({ where: { userId } });
  await prisma.walletBalance.deleteMany({ where: { userId } });
  await prisma.portfolio.deleteMany({ where: { userId } });
  await prisma.eventLog.deleteMany({ where: { userId } });
  await prisma.walletBalance.createMany({
    data: [
      { userId, currency: "USD", balance: 3200 },
      { userId, currency: "EUR", balance: 620 },
      { userId, currency: "GBP", balance: 240 },
      { userId, currency: "VND", balance: 18000000 },
    ],
  });
  await prisma.portfolio.create({
    data: {
      userId,
      currentValue: 3200,
      historyJson: JSON.stringify([
        { month: "Th01", value: 3100 },
        { month: "Th02", value: 3150 },
        { month: "Th03", value: 3200 },
      ]),
    },
  });
  await prisma.transaction.createMany({
    data: [
      { userId, type: "receive", amount: 1500, currency: "USD", recipient: "Lương tháng", fraudFlagged: false, fraudStatus: "cleared" },
      { userId, type: "send", amount: 180, currency: "USD", recipient: "Mẹ", fraudFlagged: false, fraudStatus: "cleared" },
      { userId, type: "send", amount: 240, currency: "USD", recipient: "Nhà hàng", fraudFlagged: false, fraudStatus: "cleared" },
    ],
  });
  await createEventLog(userId, 6, "Dữ liệu demo đã được reset bởi người dùng.");
  return NextResponse.json({ ok: true });
}
