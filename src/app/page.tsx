"use client";

import { useEffect, useState, type FormEvent } from "react";

type AccountData = {
  user: { id: number; name: string; email: string; kycStatus: string; riskProfile: string };
  wallets: Array<{ id: number; currency: string; balance: number }>;
  transactions: Array<any>;
  portfolio: { currentValue: number; historyJson?: string } | null;
  eventLogs: Array<{ id: number; layer: number; content: string }>;
  totalBalanceUsd: number;
  safeThreshold: number;
  investmentSuggestion: number;
  riskProfile: { label: string };
};

type ViewMode = "overview" | "payments" | "investments" | "security" | "profile";

export default function HomePage() {
  const [account, setAccount] = useState<AccountData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Đang tải dữ liệu demo...");
  const [pendingTransactionId, setPendingTransactionId] = useState<number | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authForm, setAuthForm] = useState({ email: "", password: "", name: "" });
  const [authError, setAuthError] = useState("");
  const [quickPayForm, setQuickPayForm] = useState({ amount: "", recipient: "" });
  const [activeView, setActiveView] = useState<ViewMode>("overview");

  const [onboardingForm, setOnboardingForm] = useState({ name: "", riskProfile: "balanced" });
  const [sendForm, setSendForm] = useState({ amount: "", currency: "USD", recipient: "" });
  const [depositForm, setDepositForm] = useState({ amount: "", currency: "USD", recipient: "" });
  const [convertForm, setConvertForm] = useState({ amount: "", fromCurrency: "USD", toCurrency: "EUR" });

  const loadAccount = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/account");
      const payload = await response.json();
      setAccount(payload.account);
      setStatus("Sẵn sàng cho các flow ngân hàng số");
    } catch {
      setAccount(null);
      setStatus("Không thể tải dữ liệu. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch("/api/auth")
      .then((response) => response.json())
      .then((payload) => {
        if (payload.user) {
          setAccount(payload.account);
          setAuthenticated(true);
          setStatus("Sẵn sàng cho các flow ngân hàng số");
        } else {
          setAuthenticated(false);
        }
      })
      .catch(() => setAuthenticated(false))
      .finally(() => {
        setAuthChecking(false);
        setLoading(false);
      });
  }, []);

  const formatCurrency = (value: number) => new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(value);

  const handleAuthSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setAuthError("");
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: authMode,
          email: authForm.email,
          password: authForm.password,
          name: authForm.name,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Xác thực thất bại");
      setAccount(payload.account);
      setAuthenticated(true);
      setAuthForm({ email: "", password: "", name: "" });
      setStatus(authMode === "signup" ? "Tạo tài khoản thành công." : "Đăng nhập thành công.");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Xác thực thất bại");
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    setBusy(true);
    try {
      await fetch("/api/auth", { method: "DELETE" });
    } finally {
      setAccount(null);
      setAuthenticated(false);
      setPendingTransactionId(null);
      setActiveView("overview");
      setStatus("Đã đăng xuất.");
      setBusy(false);
    }
  };

  const handleOnboarding = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const response = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: onboardingForm.name || account?.user?.name || "Khách hàng demo",
          riskProfile: onboardingForm.riskProfile,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Onboarding thất bại");
      setStatus(`Onboarding hoàn tất cho ${payload.user?.name || "khách hàng demo"}`);
      await loadAccount();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Onboarding thất bại");
    } finally {
      setBusy(false);
    }
  };

  const handleSend = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const response = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "send",
          amount: Number(sendForm.amount),
          currency: sendForm.currency,
          recipient: sendForm.recipient,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Gửi tiền thất bại");
      if (payload.requiresConfirmation) {
        setPendingTransactionId(payload.transactionId);
        setStatus("Giao dịch đã bị chặn tạm thời để xác minh bảo mật.");
      } else {
        setStatus("Giao dịch gửi tiền đã hoàn tất.");
      }
      await loadAccount();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Gửi tiền thất bại");
    } finally {
      setBusy(false);
    }
  };

  const handleDeposit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const response = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "deposit",
          amount: Number(depositForm.amount),
          currency: depositForm.currency,
          recipient: depositForm.recipient,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Nạp tiền thất bại");
      setStatus("Nạp tiền demo đã được ghi nhận.");
      await loadAccount();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Nạp tiền thất bại");
    } finally {
      setBusy(false);
    }
  };

  const handleConvert = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const response = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "convert",
          amount: Number(convertForm.amount),
          currency: convertForm.fromCurrency,
          targetCurrency: convertForm.toCurrency,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Quy đổi thất bại");
      setStatus(`Quy đổi thành công, số tiền nhận được khoảng ${formatCurrency(payload.converted || 0)} ${convertForm.toCurrency}`);
      await loadAccount();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Quy đổi thất bại");
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmFraud = async () => {
    if (!pendingTransactionId) return;
    setBusy(true);
    try {
      const response = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmFraud: true, transactionId: pendingTransactionId }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Xác nhận giao dịch thất bại");
      setPendingTransactionId(null);
      setStatus("Giao dịch đã được xác nhận và hoàn tất.");
      await loadAccount();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Xác nhận thất bại");
    } finally {
      setBusy(false);
    }
  };

  const handleInvestmentAction = async (action: "allocate" | "simulate") => {
    setBusy(true);
    try {
      const response = await fetch("/api/investment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Thao tác đầu tư thất bại");
      setStatus(action === "allocate" ? `Đã phân bổ ${payload.allocated} USD vào danh mục.` : "Mô phỏng đầu tư 1 tháng đã hoàn tất.");
      await loadAccount();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Thao tác đầu tư thất bại");
    } finally {
      setBusy(false);
    }
  };

  const handleSecuritySimulate = async () => {
    setBusy(true);
    try {
      const response = await fetch("/api/security", { method: "POST" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Mô phỏng bảo mật thất bại");
      setStatus(`Đã tạo cảnh báo lừa đảo cho ${payload.recipient}.`);
      await loadAccount();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Mô phỏng bảo mật thất bại");
    } finally {
      setBusy(false);
    }
  };

  const handleQuickPay = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const response = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "send", amount: Number(quickPayForm.amount), currency: "USD", recipient: quickPayForm.recipient }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Thanh toán nhanh thất bại");
      setStatus(`Thanh toán nhanh ${quickPayForm.amount} USD đã được xử lý cho ${quickPayForm.recipient}.`);
      await loadAccount();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Thanh toán nhanh thất bại");
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async () => {
    setBusy(true);
    try {
      const response = await fetch("/api/reset", { method: "POST" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Reset thất bại");
      setStatus("Dữ liệu demo đã được khôi phục về trạng thái ban đầu.");
      await loadAccount();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Reset thất bại");
    } finally {
      setBusy(false);
    }
  };

  const navItems: Array<{ id: ViewMode; label: string; hint: string }> = [
    { id: "overview", label: "Tổng quan", hint: "Diễn biến tài chính" },
    { id: "payments", label: "Thanh toán", hint: "Ví và chuyển tiền" },
    { id: "investments", label: "Đầu tư", hint: "Danh mục và phân bổ" },
    { id: "security", label: "Bảo mật", hint: "Giám sát rủi ro" },
    { id: "profile", label: "Hồ sơ", hint: "Thông tin tài khoản" },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-96 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.28),transparent_35%)] blur-3xl" />
        <div className="absolute -right-16 top-20 h-80 w-80 rounded-full bg-orange-500/20 blur-3xl" />
        <div className="absolute left-0 top-72 h-72 w-72 rounded-full bg-sky-500/10 blur-3xl" />

        <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-6 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-3xl bg-gradient-to-br from-cyan-400 via-sky-500 to-indigo-500 shadow-lg shadow-cyan-500/20">DP</div>
            <div>
              <p className="text-sm font-semibold tracking-[0.18em] uppercase text-slate-200">DigiPay</p>
              <p className="text-xs text-slate-400">Digital Banking Experience</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-3 rounded-full border border-slate-800 bg-slate-900/70 px-4 py-2 text-sm text-slate-300">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              {loading ? "Đang đồng bộ" : "Hệ thống sẵn sàng"}
            </div>
            {authenticated ? (
              <button
                type="button"
                onClick={() => void handleLogout()}
                disabled={busy}
                className="rounded-full border border-slate-800 bg-slate-900/70 px-4 py-2 text-sm text-slate-300 transition hover:bg-slate-800 disabled:opacity-60"
              >
                Đăng xuất
              </button>
            ) : null}
          </div>
        </header>

        <main className="relative z-10 mx-auto max-w-7xl px-6 pb-20 pt-4 sm:pb-24">
          {authChecking ? (
            <div className="flex min-h-[50vh] items-center justify-center text-slate-400">Đang kiểm tra phiên đăng nhập...</div>
          ) : !authenticated ? (
            <section className="mx-auto flex max-w-md flex-col gap-6 py-16">
              <div className="text-center">
                <h1 className="text-3xl font-semibold text-white">{authMode === "login" ? "Đăng nhập" : "Tạo tài khoản"}</h1>
                <p className="mt-2 text-sm text-slate-400">
                  {authMode === "login" ? "Đăng nhập để truy cập tài khoản ngân hàng số của bạn." : "Tạo tài khoản demo để bắt đầu trải nghiệm DigiPay."}
                </p>
              </div>

              <form onSubmit={handleAuthSubmit} className="space-y-4 rounded-[32px] border border-slate-800 bg-slate-900/80 p-6">
                {authMode === "signup" ? (
                  <input
                    value={authForm.name}
                    onChange={(event) => setAuthForm({ ...authForm, name: event.target.value })}
                    placeholder="Họ và tên"
                    className="w-full rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-white"
                  />
                ) : null}
                <input
                  type="email"
                  required
                  value={authForm.email}
                  onChange={(event) => setAuthForm({ ...authForm, email: event.target.value })}
                  placeholder="Email"
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-white"
                />
                <input
                  type="password"
                  required
                  value={authForm.password}
                  onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })}
                  placeholder="Mật khẩu"
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-white"
                />
                {authError ? <p className="text-sm text-rose-400">{authError}</p> : null}
                <button disabled={busy} className="w-full rounded-2xl bg-cyan-500 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-60">
                  {authMode === "login" ? "Đăng nhập" : "Đăng ký"}
                </button>
              </form>

              <button
                type="button"
                onClick={() => {
                  setAuthMode(authMode === "login" ? "signup" : "login");
                  setAuthError("");
                }}
                className="text-sm text-slate-400 transition hover:text-white"
              >
                {authMode === "login" ? "Chưa có tài khoản? Đăng ký ngay" : "Đã có tài khoản? Đăng nhập"}
              </button>
            </section>
          ) : (
          <section className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
            <aside className="rounded-[32px] border border-slate-800 bg-slate-900/80 p-5 shadow-[0_40px_120px_-80px_rgba(15,23,42,0.6)]">
              <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Tài khoản</p>
                <p className="mt-3 text-xl font-semibold text-white">{account?.user?.name || "Mina Chen"}</p>
                <p className="mt-1 text-sm text-slate-400">{account?.user?.kycStatus === "verified" ? "KYC đã xác minh" : "KYC đang chờ"}</p>
              </div>

              <div className="mt-5 space-y-2">
                {navItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveView(item.id)}
                    className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm transition ${activeView === item.id ? "border-cyan-500/50 bg-cyan-500/10 text-white" : "border-slate-800 bg-slate-950/60 text-slate-300 hover:bg-slate-800"}`}
                  >
                    <span>{item.label}</span>
                    <span className="text-xs text-slate-400">{item.hint}</span>
                  </button>
                ))}
              </div>

              <div className="mt-5 rounded-3xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-300">
                <p className="font-semibold text-white">Thông báo hệ thống</p>
                <p className="mt-2 leading-6">{status}</p>
              </div>
            </aside>

            <div className="space-y-6">
              <section className="rounded-[32px] border border-slate-800 bg-slate-900/80 p-6 shadow-[0_40px_120px_-80px_rgba(15,23,42,0.6)]">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Số dư tổng</p>
                    <h1 className="mt-3 text-4xl font-semibold text-white">${formatCurrency(account?.totalBalanceUsd || 0)}</h1>
                    <p className="mt-3 text-sm text-slate-400">Mức bảo toàn thanh khoản khuyến nghị: ${formatCurrency(account?.safeThreshold || 0)}</p>
                  </div>
                  <div className="rounded-3xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-sm text-slate-300">
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Đề xuất đầu tư hôm nay</p>
                    <p className="mt-2 text-xl font-semibold text-white">${formatCurrency(account?.investmentSuggestion || 0)}</p>
                  </div>
                </div>
              </section>

              {activeView === "overview" && (
                <section className="grid gap-6 xl:grid-cols-2">
                  <div className="rounded-[32px] border border-slate-800 bg-slate-900/80 p-6">
                    <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Quick actions</p>
                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      <button type="button" onClick={() => setActiveView("payments")} className="rounded-3xl border border-slate-700 bg-slate-950/70 p-4 text-left">
                        <p className="font-semibold text-white">Chuyển tiền</p>
                        <p className="mt-2 text-sm text-slate-400">Gửi tiền nhanh và xác minh bảo mật.</p>
                      </button>
                      <button type="button" onClick={() => setActiveView("investments")} className="rounded-3xl border border-slate-700 bg-slate-950/70 p-4 text-left">
                        <p className="font-semibold text-white">Đầu tư</p>
                        <p className="mt-2 text-sm text-slate-400">Tự động phân bổ tiền nhàn rỗi.</p>
                      </button>
                      <button type="button" onClick={() => setActiveView("security")} className="rounded-3xl border border-slate-700 bg-slate-950/70 p-4 text-left">
                        <p className="font-semibold text-white">Giám sát</p>
                        <p className="mt-2 text-sm text-slate-400">Phát hiện giao dịch bất thường.</p>
                      </button>
                      <button type="button" onClick={() => setActiveView("profile")} className="rounded-3xl border border-slate-700 bg-slate-950/70 p-4 text-left">
                        <p className="font-semibold text-white">Hồ sơ</p>
                        <p className="mt-2 text-sm text-slate-400">KYC và cài đặt rủi ro.</p>
                      </button>
                    </div>
                  </div>

                  <div className="rounded-[32px] border border-slate-800 bg-slate-900/80 p-6">
                    <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Ví của bạn</p>
                    <div className="mt-5 space-y-3">
                      {account?.wallets?.map((wallet: any) => (
                        <div key={wallet.id} className="flex items-center justify-between rounded-3xl border border-slate-800 bg-slate-950/70 px-4 py-4">
                          <div>
                            <p className="text-sm font-semibold text-white">{wallet.currency}</p>
                            <p className="text-xs text-slate-500">Số dư khả dụng</p>
                          </div>
                          <p className="text-lg font-semibold text-white">{formatCurrency(wallet.balance)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              )}

              {activeView === "payments" && (
                <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                  <div className="rounded-[32px] border border-slate-800 bg-slate-900/80 p-6">
                    <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Thanh toán</p>
                    <h2 className="mt-2 text-2xl font-semibold text-white">Gửi tiền và nạp tiền trong một luồng</h2>
                    <div className="mt-6 grid gap-4 md:grid-cols-2">
                      <form onSubmit={handleDeposit} className="rounded-3xl border border-slate-800 bg-slate-950/70 p-4 space-y-3">
                        <p className="text-sm font-semibold text-white">Nạp tiền</p>
                        <input value={depositForm.amount} onChange={(event) => setDepositForm({ ...depositForm, amount: event.target.value })} placeholder="Số tiền" className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-white" />
                        <select value={depositForm.currency} onChange={(event) => setDepositForm({ ...depositForm, currency: event.target.value })} className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-white">
                          <option value="USD">USD</option>
                          <option value="EUR">EUR</option>
                          <option value="GBP">GBP</option>
                          <option value="VND">VND</option>
                        </select>
                        <input value={depositForm.recipient} onChange={(event) => setDepositForm({ ...depositForm, recipient: event.target.value })} placeholder="Mô tả nạp tiền" className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-white" />
                        <button disabled={busy} className="w-full rounded-2xl bg-emerald-500 px-3 py-2 font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-60">Nạp tiền</button>
                      </form>

                      <form onSubmit={handleSend} className="rounded-3xl border border-slate-800 bg-slate-950/70 p-4 space-y-3">
                        <p className="text-sm font-semibold text-white">Chuyển khoản</p>
                        <input value={sendForm.amount} onChange={(event) => setSendForm({ ...sendForm, amount: event.target.value })} placeholder="Số tiền" className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-white" />
                        <select value={sendForm.currency} onChange={(event) => setSendForm({ ...sendForm, currency: event.target.value })} className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-white">
                          <option value="USD">USD</option>
                          <option value="EUR">EUR</option>
                          <option value="GBP">GBP</option>
                          <option value="VND">VND</option>
                        </select>
                        <input value={sendForm.recipient} onChange={(event) => setSendForm({ ...sendForm, recipient: event.target.value })} placeholder="Người nhận" className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-white" />
                        <button disabled={busy} className="w-full rounded-2xl bg-white px-3 py-2 font-semibold text-slate-950 transition hover:bg-slate-200 disabled:opacity-60">Gửi tiền</button>
                      </form>
                    </div>

                    <form onSubmit={handleQuickPay} className="mt-4 rounded-3xl border border-slate-800 bg-slate-950/70 p-4 space-y-3">
                      <p className="text-sm font-semibold text-white">Thanh toán nhanh</p>
                      <div className="grid gap-3 md:grid-cols-2">
                        <input value={quickPayForm.amount} onChange={(event) => setQuickPayForm({ ...quickPayForm, amount: event.target.value })} placeholder="Số tiền USD" className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-white" />
                        <input value={quickPayForm.recipient} onChange={(event) => setQuickPayForm({ ...quickPayForm, recipient: event.target.value })} placeholder="Người nhận / đối tác" className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-white" />
                      </div>
                      <button disabled={busy} className="w-full rounded-2xl bg-cyan-500 px-3 py-2 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-60">Thanh toán nhanh</button>
                    </form>
                  </div>

                  <div className="rounded-[32px] border border-slate-800 bg-slate-900/80 p-6">
                    <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Xác minh bảo mật</p>
                    <div className="mt-5 rounded-3xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-300">
                      <p className="font-semibold text-white">Hệ thống đang giám sát giao dịch</p>
                      <p className="mt-2 leading-6">Nếu giao dịch vượt ngưỡng rủi ro, hệ thống sẽ chặn và yêu cầu xác nhận bổ sung.</p>
                    </div>
                    {pendingTransactionId ? (
                      <button onClick={() => void handleConfirmFraud()} disabled={busy} className="mt-4 w-full rounded-2xl border border-amber-500 px-4 py-3 font-semibold text-amber-300 transition hover:bg-amber-500/10 disabled:opacity-60">Xác nhận giao dịch bảo mật</button>
                    ) : null}
                  </div>
                </section>
              )}

              {activeView === "investments" && (
                <section className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
                  <div className="rounded-[32px] border border-slate-800 bg-slate-900/80 p-6">
                    <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Đầu tư</p>
                    <h2 className="mt-2 text-2xl font-semibold text-white">Phân bổ dòng tiền theo khẩu vị rủi ro</h2>
                    <div className="mt-6 rounded-3xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-300">
                      <p className="font-semibold text-white">Phân bổ đề xuất</p>
                      <p className="mt-2 leading-6">Bạn có thể tự động chuyển khoảng ${formatCurrency(account?.investmentSuggestion || 0)} vào danh mục phù hợp với mức rủi ro {account?.riskProfile?.label || "Cân bằng"}.</p>
                    </div>
                    <div className="mt-5 flex gap-3">
                      <button onClick={() => void handleInvestmentAction("allocate")} disabled={busy} className="flex-1 rounded-2xl bg-emerald-500 px-4 py-3 font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-60">Phân bổ ngay</button>
                      <button onClick={() => void handleInvestmentAction("simulate")} disabled={busy} className="flex-1 rounded-2xl border border-slate-700 px-4 py-3 font-semibold text-slate-100 transition hover:bg-white/10 disabled:opacity-60">Mô phỏng tháng</button>
                    </div>
                  </div>

                  <div className="rounded-[32px] border border-slate-800 bg-slate-900/80 p-6">
                    <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Lịch sử đầu tư</p>
                    <div className="mt-6 space-y-3">
                      {account?.transactions?.slice(0, 5).map((tx: any) => (
                        <div key={tx.id} className="rounded-3xl border border-slate-800 bg-slate-950/70 px-4 py-4 text-sm text-slate-300">
                          <p className="font-semibold text-white">{tx.type === "convert" ? "Quy đổi" : tx.type === "send" ? "Chuyển khoản" : "Nhận tiền"}</p>
                          <p className="mt-1">{tx.recipient || "Giao dịch ví"}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              )}

              {activeView === "security" && (
                <section className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
                  <div className="rounded-[32px] border border-slate-800 bg-slate-900/80 p-6">
                    <p className="text-sm uppercase tracking-[0.24em] text-slate-500">An ninh số</p>
                    <h2 className="mt-2 text-2xl font-semibold text-white">Giám sát giao dịch và phát hiện rủi ro</h2>
                    <div className="mt-6 space-y-3">
                      <button onClick={() => void handleSecuritySimulate()} disabled={busy} className="w-full rounded-2xl bg-rose-500 px-4 py-3 font-semibold text-white transition hover:bg-rose-400 disabled:opacity-60">Mô phỏng cảnh báo lừa đảo</button>
                      <button onClick={() => void handleReset()} disabled={busy} className="w-full rounded-2xl border border-slate-700 px-4 py-3 font-semibold text-slate-100 transition hover:bg-white/10 disabled:opacity-60">Reset dữ liệu demo</button>
                    </div>
                  </div>

                  <div className="rounded-[32px] border border-slate-800 bg-slate-900/80 p-6">
                    <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Event log</p>
                    <div className="mt-6 space-y-3">
                      {account?.eventLogs?.slice(0, 8).map((log: any) => (
                        <div key={log.id} className="rounded-3xl border border-slate-800 bg-slate-950/70 px-4 py-4 text-sm text-slate-300">
                          <p className="font-semibold text-white">Layer {log.layer}</p>
                          <p className="mt-1">{log.content}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              )}

              {activeView === "profile" && (
                <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                  <div className="rounded-[32px] border border-slate-800 bg-slate-900/80 p-6">
                    <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Hồ sơ khách hàng</p>
                    <h2 className="mt-2 text-2xl font-semibold text-white">Thông tin tài khoản và KYC</h2>
                    <form onSubmit={handleOnboarding} className="mt-6 space-y-4">
                      <input value={onboardingForm.name} onChange={(event) => setOnboardingForm({ ...onboardingForm, name: event.target.value })} placeholder="Tên khách hàng" className="w-full rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-white" />
                      <select value={onboardingForm.riskProfile} onChange={(event) => setOnboardingForm({ ...onboardingForm, riskProfile: event.target.value })} className="w-full rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-white">
                        <option value="conservative">Thận trọng</option>
                        <option value="balanced">Cân bằng</option>
                        <option value="growth">Tăng trưởng</option>
                      </select>
                      <button disabled={busy} className="w-full rounded-2xl bg-cyan-500 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-60">Cập nhật hồ sơ</button>
                    </form>
                  </div>

                  <div className="rounded-[32px] border border-slate-800 bg-slate-900/80 p-6">
                    <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Status</p>
                    <div className="mt-5 space-y-3">
                      <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-4">
                        <p className="text-xs uppercase tracking-[0.24em] text-slate-500">KYC</p>
                        <p className="mt-2 text-xl font-semibold text-white">{account?.user?.kycStatus === "verified" ? "Đã xác minh" : "Chờ xác minh"}</p>
                      </div>
                      <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-4">
                        <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Mức rủi ro</p>
                        <p className="mt-2 text-xl font-semibold text-white">{account?.riskProfile?.label || "Cân bằng"}</p>
                      </div>
                      <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-4">
                        <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Email đăng nhập</p>
                        <p className="mt-2 text-xl font-semibold text-white">{account?.user?.email || "—"}</p>
                      </div>
                    </div>
                  </div>
                </section>
              )}
            </div>
          </section>
          )}
        </main>
      </div>
    </div>
  );
}
