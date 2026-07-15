import { NextResponse } from "next/server";
import { createEventLog, deductUsdFromWallet, getAccountState, simulatePortfolio, updateUserKyc } from "@/lib/banking";
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
    const allocatedAmount = Math.round(Math.max(state.investmentSuggestion, 0));
    if (allocatedAmount <= 0) {
      return NextResponse.json({ error: "Không có số dư nhàn rỗi để phân bổ." }, { status: 400 });
    }
    if (allocatedAmount > state.totalBalanceUsd) {
      return NextResponse.json({ error: "Số dư không đủ để phân bổ." }, { status: 400 });
    }

    const deducted = await deductUsdFromWallet(userId, allocatedAmount);
    if (!deducted) {
      return NextResponse.json({ error: "Số dư không đủ để phân bổ." }, { status: 400 });
    }

    const portfolio = state.portfolio;
    const nextValue = Math.round((portfolio?.currentValue ?? 0) + allocatedAmount);

    if (portfolio) {
      await prisma.portfolio.update({
        where: { id: portfolio.id },
        data: { currentValue: nextValue, updatedAt: new Date() },
      });
    } else {
      await prisma.portfolio.create({
        data: { userId, currentValue: nextValue, historyJson: JSON.stringify([{ month: "Th01", value: nextValue }]) },
      });
    }

    await createEventLog(userId, 3, `Hệ thống đã đề xuất và áp dụng phân bổ ${allocatedAmount} USD vào danh mục đầu tư.`);
    await createEventLog(userId, 4, `Khoản tiền phân bổ đã được chuyển vào danh mục đầu tư tự động.`);
    return NextResponse.json({ ok: true, allocated: allocatedAmount });
  }

  if (action === "simulate") {
    const result = await simulatePortfolio(userId);
    return NextResponse.json({ ok: true, result });
  }

  return NextResponse.json({ error: "Hành động không hợp lệ." }, { status: 400 });
}
