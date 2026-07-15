import { NextResponse } from "next/server";
import { createUserAccount, getAccountState, toPublicUser } from "@/lib/banking";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/password";
import { createSession, deleteSession, getSessionUserId } from "@/lib/session";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ user: null });
  }

  const state = await getAccountState(userId);
  return NextResponse.json({
    user: toPublicUser(state.user),
    account: { ...state, user: toPublicUser(state.user) },
  });
}

export async function POST(request: Request) {
  const { mode, email, password, name } = await request.json();

  if (!email || !password) {
    return NextResponse.json({ error: "Email và mật khẩu là bắt buộc." }, { status: 400 });
  }

  const normalizedEmail = String(email).toLowerCase().trim();

  if (mode === "signup") {
    if (String(password).length < 6) {
      return NextResponse.json({ error: "Mật khẩu phải có ít nhất 6 ký tự." }, { status: 400 });
    }

    const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existingUser) {
      return NextResponse.json({ error: "Email này đã tồn tại." }, { status: 409 });
    }

    const user = await createUserAccount(name || "Khách hàng mới", normalizedEmail, hashPassword(password));
    await createSession(user.id);
    const state = await getAccountState(user.id);
    return NextResponse.json({
      ok: true,
      user: toPublicUser(user),
      account: { ...state, user: toPublicUser(state.user) },
    });
  }

  if (mode === "login") {
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ error: "Email hoặc mật khẩu không đúng." }, { status: 401 });
    }

    await createSession(user.id);
    const state = await getAccountState(user.id);
    return NextResponse.json({
      ok: true,
      user: toPublicUser(user),
      account: { ...state, user: toPublicUser(state.user) },
    });
  }

  return NextResponse.json({ error: "Mode không hợp lệ." }, { status: 400 });
}

export async function DELETE() {
  await deleteSession();
  return NextResponse.json({ ok: true });
}
