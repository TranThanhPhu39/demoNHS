import { NextResponse } from "next/server";
import { getAccountState, toPublicUser } from "@/lib/banking";
import { getSessionUserId } from "@/lib/session";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  }

  const state = await getAccountState(userId);
  const history = state.portfolio?.historyJson ? JSON.parse(state.portfolio.historyJson) : [];

  return NextResponse.json({
    account: {
      user: toPublicUser(state.user),
      wallets: state.wallets,
      transactions: state.transactions,
      portfolio: state.portfolio ? { ...state.portfolio, history } : null,
      eventLogs: state.eventLogs,
      totalBalanceUsd: state.totalBalanceUsd,
      safeThreshold: state.safeThreshold,
      investmentSuggestion: state.investmentSuggestion,
      riskProfile: state.riskProfile,
    },
  });
}
