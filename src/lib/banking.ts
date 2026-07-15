import { prisma } from "@/lib/prisma";

export function toPublicUser<T extends { passwordHash: string }>(user: T): Omit<T, "passwordHash"> {
  const publicUser: Partial<T> = { ...user };
  delete publicUser.passwordHash;
  return publicUser as Omit<T, "passwordHash">;
}

export const EXCHANGE_RATES: Record<string, number> = {
  USD: 1,
  EUR: 1.08,
  GBP: 1.27,
  VND: 0.00004,
};

export const CONVERSION_FEE_RATE = 0.005;

export const RISK_PROFILES: Record<string, { label: string; stocks: number; bonds: number; cash: number }> = {
  conservative: { label: "Thận trọng", stocks: 0.3, bonds: 0.6, cash: 0.1 },
  balanced: { label: "Cân bằng", stocks: 0.5, bonds: 0.4, cash: 0.1 },
  growth: { label: "Tăng trưởng", stocks: 0.8, bonds: 0.15, cash: 0.05 },
};

export function convertAmount(amount: number, fromCurrency: string, toCurrency: string, includeFee = false) {
  const usdValue = amount * EXCHANGE_RATES[fromCurrency];
  const adjusted = includeFee ? usdValue * (1 - CONVERSION_FEE_RATE) : usdValue;
  return adjusted / EXCHANGE_RATES[toCurrency];
}

export function toUsd(amount: number, currency: string) {
  return amount * EXCHANGE_RATES[currency];
}

export function fromUsd(amount: number, currency: string) {
  return amount / EXCHANGE_RATES[currency];
}

export async function createEventLog(userId: number, layer: number, content: string) {
  await prisma.eventLog.create({
    data: { userId, layer, content },
  });
}

export async function seedUserAccount(userId: number, displayName: string) {
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
      { userId, type: "receive", amount: 1500, currency: "USD", recipient: "Lương tháng", timestamp: new Date("2026-06-01"), fraudFlagged: false, fraudStatus: "cleared" },
      { userId, type: "send", amount: 180, currency: "USD", recipient: "Mẹ", timestamp: new Date("2026-06-10"), fraudFlagged: false, fraudStatus: "cleared" },
      { userId, type: "send", amount: 240, currency: "USD", recipient: "Nhà hàng", timestamp: new Date("2026-06-19"), fraudFlagged: false, fraudStatus: "cleared" },
    ],
  });

  await createEventLog(userId, 1, `Đã tạo tài khoản cho ${displayName} và hoàn tất onboarding giả lập.`);
  await createEventLog(userId, 2, "Ví đa tiền tệ được khởi tạo với số dư ban đầu.");
  await createEventLog(userId, 3, "Hệ thống phân bổ dòng tiền đã bật tính năng đề xuất đầu tư.");
}

export async function ensureDemoUser() {
  let user = await prisma.user.findFirst({ orderBy: { id: "asc" } });

  if (!user) {
    user = await prisma.user.create({
      data: {
        name: "Mina Chen",
        email: "demo@digipay.local",
        passwordHash: "demo",
        kycStatus: "pending",
        riskProfile: "balanced",
      },
    });

    await seedUserAccount(user.id, user.name);
  }

  return user;
}

export async function createUserAccount(name: string, email: string, passwordHash: string) {
  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      kycStatus: "pending",
      riskProfile: "balanced",
    },
  });

  await seedUserAccount(user.id, name);
  return user;
}

export async function getAccountState(userId?: number) {
  const user = await (userId ? prisma.user.findUnique({ where: { id: userId } }) : prisma.user.findFirst({ orderBy: { id: "asc" } }));
  if (!user) {
    const created = await ensureDemoUser();
    return getAccountState(created.id);
  }

  const [wallets, transactions, portfolio, eventLogs] = await Promise.all([
    prisma.walletBalance.findMany({ where: { userId: user.id }, orderBy: { currency: "asc" } }),
    prisma.transaction.findMany({ where: { userId: user.id }, orderBy: { timestamp: "desc" } }),
    prisma.portfolio.findFirst({ where: { userId: user.id } }),
    prisma.eventLog.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
  ]);

  const totalBalanceUsd = wallets.reduce((sum, wallet) => sum + toUsd(wallet.balance, wallet.currency), 0);
  const monthlySpending = transactions
    .filter((transaction) => transaction.type === "send" && transaction.fraudStatus !== "pending")
    .reduce((sum, transaction) => sum + toUsd(transaction.amount, transaction.currency), 0);
  const monthlyAverage = monthlySpending > 0 ? monthlySpending / Math.max(1, Math.min(3, transactions.length)) : 300;
  const safeThreshold = monthlyAverage * 3;
  const investmentSuggestion = Math.max(totalBalanceUsd - safeThreshold, 0);
  const riskProfile = RISK_PROFILES[user.riskProfile] ?? RISK_PROFILES.balanced;

  return {
    user,
    wallets,
    transactions,
    portfolio,
    eventLogs,
    totalBalanceUsd,
    safeThreshold,
    investmentSuggestion,
    riskProfile,
  };
}

export async function updateUserKyc(userId: number, name: string, riskProfile: string) {
  return prisma.user.update({
    where: { id: userId },
    data: { name, riskProfile, kycStatus: "verified" },
  });
}

export async function updateWalletBalance(userId: number, currency: string, delta: number) {
  const wallet = await prisma.walletBalance.findFirst({ where: { userId, currency } });
  if (!wallet) {
    await prisma.walletBalance.create({ data: { userId, currency, balance: Math.max(delta, 0) } });
    return;
  }
  await prisma.walletBalance.update({
    where: { id: wallet.id },
    data: { balance: wallet.balance + delta },
  });
}

export async function simulatePortfolio(userId: number) {
  const state = await getAccountState(userId);
  const portfolio = state.portfolio;
  const riskProfile = RISK_PROFILES[state.user.riskProfile] ?? RISK_PROFILES.balanced;
  const currentValue = portfolio?.currentValue ?? state.totalBalanceUsd;
  const stockReturn = (Math.random() * 0.08) + 0.02;
  const bondReturn = (Math.random() * 0.04) - 0.01;
  const cashReturn = (Math.random() * 0.004) + 0.001;
  const nextValue = currentValue * (1 + riskProfile.stocks * stockReturn + riskProfile.bonds * bondReturn + riskProfile.cash * cashReturn);

  const history = portfolio?.historyJson ? JSON.parse(portfolio.historyJson) : [];
  const newHistory = [...history, { month: `Th${history.length + 1}`, value: Math.round(nextValue) }];

  if (portfolio) {
    await prisma.portfolio.update({
      where: { id: portfolio.id },
      data: { currentValue: Math.round(nextValue), historyJson: JSON.stringify(newHistory), updatedAt: new Date() },
    });
  } else {
    await prisma.portfolio.create({
      data: { userId, currentValue: Math.round(nextValue), historyJson: JSON.stringify(newHistory) },
    });
  }

  await createEventLog(userId, 4, `Mô phỏng đầu tư 1 tháng hoàn tất với mức lợi nhuận ước tính ${Math.round((nextValue / currentValue - 1) * 100)}%.`);
  return { currentValue: Math.round(nextValue), history: newHistory };
}
