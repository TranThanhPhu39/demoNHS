import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CONVERSION_FEE_RATE, createEventLog, EXCHANGE_RATES, getAccountState, toUsd } from "@/lib/banking";
import { getSessionUserId } from "@/lib/session";

export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  }

  const { type, amount, currency, recipient, targetCurrency, confirmFraud, transactionId } = await request.json();
  const state = await getAccountState(userId);

  if (confirmFraud && transactionId) {
    const pending = await prisma.transaction.findUnique({ where: { id: transactionId } });
    if (!pending || pending.userId !== userId) {
      return NextResponse.json({ error: "Không tìm thấy giao dịch chờ xác nhận." }, { status: 404 });
    }

    const sourceWallet = await prisma.walletBalance.findFirst({ where: { userId: userId, currency: pending.currency } });
    if (!sourceWallet) {
      return NextResponse.json({ error: "Ví nguồn không tồn tại." }, { status: 400 });
    }

    if (sourceWallet.balance < pending.amount) {
      return NextResponse.json({ error: "Số dư không đủ để hoàn tất giao dịch." }, { status: 400 });
    }

    await prisma.walletBalance.update({ where: { id: sourceWallet.id }, data: { balance: sourceWallet.balance - pending.amount } });
    await prisma.transaction.update({ where: { id: pending.id }, data: { fraudStatus: "approved" } });
    await createEventLog(userId, 5, `Giao dịch ${pending.id} đã được xác nhận bổ sung và hoàn tất.`);
    return NextResponse.json({ ok: true, approved: true });
  }

  if (type === "deposit") {
    await prisma.walletBalance.updateMany({ where: { userId: userId, currency }, data: { balance: { increment: amount } } });
    await prisma.transaction.create({ data: { userId: userId, type: "receive", amount, currency, recipient: recipient || "Nạp tiền demo", fraudFlagged: false, fraudStatus: "cleared" } });
    await createEventLog(userId, 2, `Đã ghi nhận nạp ${amount} ${currency} vào ví.`);
    return NextResponse.json({ ok: true });
  }

  if (type === "send") {
    const amountUsd = toUsd(Number(amount), currency);
    const totalBalanceUsd = state.wallets.reduce((sum, wallet) => sum + toUsd(wallet.balance, wallet.currency), 0);
    const recipientSeen = state.transactions.some((transaction) => transaction.recipient?.toLowerCase() === recipient?.toLowerCase());

    if (!recipientSeen && amountUsd > totalBalanceUsd * 0.5) {
      const pendingTransaction = await prisma.transaction.create({
        data: {
          userId: userId,
          type: "send",
          amount: Number(amount),
          currency,
          recipient: recipient || "Không xác định",
          fraudFlagged: true,
          fraudStatus: "pending",
        },
      });
      await createEventLog(userId, 5, `Giao dịch gửi ${amount} ${currency} tới ${recipient} đã bị chặn tạm thời để xác minh bổ sung.`);
      return NextResponse.json({ ok: true, requiresConfirmation: true, transactionId: pendingTransaction.id });
    }

    const sourceWallet = await prisma.walletBalance.findFirst({ where: { userId: userId, currency } });
    if (!sourceWallet || sourceWallet.balance < Number(amount)) {
      return NextResponse.json({ error: "Số dư không đủ." }, { status: 400 });
    }

    await prisma.walletBalance.update({ where: { id: sourceWallet.id }, data: { balance: sourceWallet.balance - Number(amount) } });
    await prisma.transaction.create({ data: { userId: userId, type: "send", amount: Number(amount), currency, recipient: recipient || "Không xác định", fraudFlagged: false, fraudStatus: "cleared" } });
    await createEventLog(userId, 2, `Đã gửi ${amount} ${currency} tới ${recipient || "người nhận"}.`);
    return NextResponse.json({ ok: true });
  }

  if (type === "convert") {
    const converted = Number(amount) * EXCHANGE_RATES[currency] / EXCHANGE_RATES[targetCurrency] * (1 - CONVERSION_FEE_RATE);
    const sourceWallet = await prisma.walletBalance.findFirst({ where: { userId: userId, currency } });
    const targetWallet = await prisma.walletBalance.findFirst({ where: { userId: userId, currency: targetCurrency } });
    if (!sourceWallet || sourceWallet.balance < Number(amount)) {
      return NextResponse.json({ error: "Số dư không đủ để quy đổi." }, { status: 400 });
    }

    await prisma.walletBalance.update({ where: { id: sourceWallet.id }, data: { balance: sourceWallet.balance - Number(amount) } });
    if (targetWallet) {
      await prisma.walletBalance.update({ where: { id: targetWallet.id }, data: { balance: targetWallet.balance + converted } });
    } else {
      await prisma.walletBalance.create({ data: { userId: userId, currency: targetCurrency, balance: converted } });
    }

    await prisma.transaction.create({ data: { userId: userId, type: "convert", amount: Number(amount), currency, recipient: targetCurrency, fraudFlagged: false, fraudStatus: "cleared" } });
    await createEventLog(userId, 2, `Đã quy đổi ${amount} ${currency} sang ${targetCurrency} sau phí 0.5%.`);
    return NextResponse.json({ ok: true, converted });
  }

  return NextResponse.json({ error: "Loại giao dịch không hợp lệ." }, { status: 400 });
}
