import { NextResponse } from "next/server";
import { createAdminSession, isAdmin, revokeAdminSession, validPassword } from "@/lib/admin-auth";
import { clearLoginAttempts, canAttemptLogin, registerFailedLogin } from "@/lib/login-attempts";
import { getRequestIp } from "@/lib/request-meta";

export async function GET(request: Request) {
  return NextResponse.json({ authenticated: await isAdmin(request) });
}

export async function POST(request: Request) {
  const key = `seller:${getRequestIp(request)}`;
  const allowance = await canAttemptLogin("seller", key);
  if (!allowance.allowed) return NextResponse.json({ error: "Demasiados intentos. Probá más tarde." }, { status: 429 });
  const { password } = await request.json();
  if (typeof password !== "string" || !validPassword(password)) {
    const attempt = await registerFailedLogin("seller", key);
    return NextResponse.json({ error: attempt.blocked ? "Demasiados intentos. Esperá unos minutos." : "Contraseña incorrecta" }, { status: attempt.blocked ? 429 : 401 });
  }
  await clearLoginAttempts("seller", key);
  const response = NextResponse.json({ authenticated: true });
  response.headers.set("Set-Cookie", await createAdminSession());
  return response;
}

export async function DELETE(request: Request) {
  await revokeAdminSession(request);
  const response = NextResponse.json({ authenticated: false });
  response.headers.set("Set-Cookie", "electronorte_admin=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0");
  return response;
}
