import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { isCouponUsable, normalizeCode } from "@/lib/coupons";
import { getRequestIp } from "@/lib/request-meta";
import { CouponModel } from "@/models/Coupon";

// Freno simple contra adivinar códigos: 15 intentos por minuto por IP (por instancia del servidor).
const hits = new Map<string, number[]>();
function tooMany(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((time) => now - time < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > 15;
}

/** Valida un código exacto. No existe forma de listar los cupones desde acá. */
export async function GET(request: Request) {
  if (tooMany(getRequestIp(request))) return NextResponse.json({ error: "Demasiados intentos. Probá en un minuto." }, { status: 429 });
  const code = normalizeCode(new URL(request.url).searchParams.get("code") ?? "");
  const invalid = NextResponse.json({ error: "Cupón inválido o vencido." }, { status: 404 });
  if (code.length < 3) return invalid;
  await connectDb();
  const coupon = await CouponModel.findOne({ code }).lean() as { code: string; type: string; value: number; minTotal?: number; active: boolean; endsAt?: Date | null } | null;
  if (!coupon || !isCouponUsable(coupon)) return invalid;
  const response = NextResponse.json({ code: coupon.code, type: coupon.type, value: coupon.value, minTotal: coupon.minTotal ?? 0 });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
