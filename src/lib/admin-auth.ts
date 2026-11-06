import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { connectDb } from "@/lib/db";
import { AdminSessionModel } from "@/models/AdminSession";

const cookieName = "electronorte_admin";

/** Sin actividad por este tiempo la sesión se cierra; además dura 8 horas como máximo. */
export const IDLE_LIMIT_MS = 30 * 60 * 1000;
export const SESSION_MAX_MS = 8 * 60 * 60 * 1000;
const TOUCH_EVERY_MS = 60 * 1000;

type SessionTimes = { expiresAt: Date; lastSeenAt?: Date | null; createdAt?: Date | null };

export function isSessionActive(session: SessionTimes, now = new Date()): boolean {
  if (session.expiresAt.getTime() <= now.getTime()) return false;
  const lastActivity = session.lastSeenAt ?? session.createdAt ?? now;
  return now.getTime() - lastActivity.getTime() < IDLE_LIMIT_MS;
}

export function shouldTouchSession(session: SessionTimes, now = new Date()): boolean {
  const lastActivity = session.lastSeenAt ?? session.createdAt ?? new Date(0);
  return now.getTime() - lastActivity.getTime() >= TOUCH_EVERY_MS;
}

function hashToken(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function isAdmin(request: Request) {
  const value = request.headers.get("cookie")?.match(new RegExp(`(?:^|; )${cookieName}=([^;]*)`))?.[1];
  if (!value) return false;
  await connectDb();
  const tokenHash = hashToken(value);
  const session = await AdminSessionModel.findOne({ tokenHash }).lean() as (SessionTimes & { _id: unknown }) | null;
  if (!session) return false;
  const now = new Date();
  if (!isSessionActive(session, now)) {
    await AdminSessionModel.deleteOne({ tokenHash });
    return false;
  }
  if (shouldTouchSession(session, now)) await AdminSessionModel.updateOne({ tokenHash }, { $set: { lastSeenAt: now } });
  return true;
}

export function validPassword(password: string) {
  const configured = process.env.ADMIN_PASSWORD;
  if (!configured || configured.length !== password.length) return false;
  return timingSafeEqual(Buffer.from(configured), Buffer.from(password));
}

export async function createAdminSession() {
  const value = randomBytes(32).toString("base64url");
  await connectDb();
  await AdminSessionModel.create({ tokenHash: hashToken(value), expiresAt: new Date(Date.now() + SESSION_MAX_MS), lastSeenAt: new Date() });
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
