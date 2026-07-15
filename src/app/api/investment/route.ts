import { NextResponse } from "next/server";
import { createEventLog, getAccountState, simulatePortfolio, updateUserKyc } from "@/lib/banking";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  }

  const { action, riskProfile } = await request.json();
  const state = await getAccountState(userId);

  if (action === "update-profile") {
    await updateUserKyc(userId, state.user.name, riskProfile);
    await createEventLog(userId, 4, `Đã cập nhật khẩu vị rủi ro sang ${riskProfile}.`);
    return NextResponse.json({ ok: true });
  }

  if (action === "allocate") {
    const suggestion = Math.max(state.investmentSuggestion, 0);
    const portfolio = state.portfolio;
    const nextValue = (portfolio?.currentValue ?? state.totalBalanceUsd) + suggestion;

    if (portfolio) {
      await prisma.portfolio.update({
        where: { id: portfolio.id },
        data: { currentValue: Math.round(nextValue), updatedAt: new Date() },
      });
    } else {
      await prisma.portfolio.create({
        data: { userId, currentValue: Math.round(nextValue), historyJson: JSON.stringify([{ month: "Th01", value: Math.round(nextValue) }]) },
      });
    }

    await createEventLog(userId, 3, `Hệ thống đã đề xuất và áp dụng phân bổ ${Math.round(suggestion)} USD vào danh mục đầu tư.`);
    await createEventLog(userId, 4, `Khoản tiền phân bổ đã được chuyển vào danh mục đầu tư tự động.`);
    return NextResponse.json({ ok: true, allocated: Math.round(suggestion) });
  }

  if (action === "simulate") {
    const result = await simulatePortfolio(userId);
    return NextResponse.json({ ok: true, result });
  }

  return NextResponse.json({ error: "Hành động không hợp lệ." }, { status: 400 });
}
