import { NextResponse } from "next/server";
import { ensureDemoUser, getAccountState } from "@/lib/banking";

export async function GET() {
  const user = await ensureDemoUser();
  const state = await getAccountState(user.id);
  return NextResponse.json({
    accountId: user.id,
    owner: user.name,
    totalBalanceUsd: state.totalBalanceUsd,
    wallets: state.wallets.map((wallet) => ({
      currency: wallet.currency,
      balance: wallet.balance,
    })),
    riskProfile: user.riskProfile,
  });
}
