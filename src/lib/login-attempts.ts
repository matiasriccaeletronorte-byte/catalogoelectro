import { connectDb } from "@/lib/db";
import { LoginAttemptModel } from "@/models/LoginAttempt";

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const BLOCK_MS = 30 * 60 * 1000;

function isActiveBlock(blockedUntil: Date | null | undefined) {
  return !!blockedUntil && blockedUntil.getTime() > Date.now();
}

export async function canAttemptLogin(role: "seller" | "customer", key: string) {
  await connectDb();
  const record = await LoginAttemptModel.findOne({ role, key });
  if (!record) return { allowed: true as const };
  if (isActiveBlock(record.blockedUntil)) {
    return { allowed: false as const, retryAfterMs: record.blockedUntil!.getTime() - Date.now() };
  }
  return { allowed: true as const };
}

export async function registerFailedLogin(role: "seller" | "customer", key: string) {
  await connectDb();
  const now = new Date();
  const record = await LoginAttemptModel.findOne({ role, key });
  if (!record) {
    await LoginAttemptModel.create({ role, key, count: 1, lastAttemptAt: now });
    return { blocked: false as const, remaining: MAX_ATTEMPTS - 1 };
  }

  const elapsed = now.getTime() - record.lastAttemptAt.getTime();
  const count = elapsed > WINDOW_MS ? 1 : record.count + 1;
  record.count = count;
  record.lastAttemptAt = now;
  if (count >= MAX_ATTEMPTS) {
    record.blockedUntil = new Date(now.getTime() + BLOCK_MS);
    await record.save();
    return { blocked: true as const, retryAfterMs: BLOCK_MS };
  }

  record.blockedUntil = null;
  await record.save();
  return { blocked: false as const, remaining: MAX_ATTEMPTS - count };
}

export async function clearLoginAttempts(role: "seller" | "customer", key: string) {
  await connectDb();
  await LoginAttemptModel.deleteOne({ role, key });
}
