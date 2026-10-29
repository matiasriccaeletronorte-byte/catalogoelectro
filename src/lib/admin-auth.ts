import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { connectDb } from "@/lib/db";
import { AdminSessionModel } from "@/models/AdminSession";

const cookieName = "electronorte_admin";

function hashToken(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function isAdmin(request: Request) {
  const value = request.headers.get("cookie")?.match(new RegExp(`(?:^|; )${cookieName}=([^;]*)`))?.[1];
  if (!value) return false;
  await connectDb();
  const session = await AdminSessionModel.findOne({ tokenHash: hashToken(value), expiresAt: { $gt: new Date() } }).lean();
  return Boolean(session);
}

export function validPassword(password: string) {
  const configured = process.env.ADMIN_PASSWORD;
  if (!configured || configured.length !== password.length) return false;
  return timingSafeEqual(Buffer.from(configured), Buffer.from(password));
}

export async function createAdminSession() {
  const value = randomBytes(32).toString("base64url");
  await connectDb();
  await AdminSessionModel.create({ tokenHash: hashToken(value), expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000) });
  return `${cookieName}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=28800${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}

export async function revokeAdminSession(request: Request) {
  const value = request.headers.get("cookie")?.match(new RegExp(`(?:^|; )${cookieName}=([^;]*)`))?.[1];
  if (!value) return;
  await connectDb();
  await AdminSessionModel.deleteOne({ tokenHash: hashToken(value) });
}

export function unauthorized() {
  return Response.json({ error: "No autorizado" }, { status: 401 });
}
