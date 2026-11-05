export type CouponType = "percent" | "fixed";

/** Lo que el cliente necesita para aplicar un cupón; nunca incluye datos internos. */
export type PublicCoupon = { code: string; type: CouponType; value: number; minTotal: number };

export const MAX_PERCENT = 90;

export function normalizeCode(raw: string): string {
  return raw.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9_-]/g, "").toUpperCase().slice(0, 24);
}

export function isCouponUsable(coupon: { active: boolean; endsAt?: Date | string | null }, now = new Date()): boolean {
  if (!coupon.active) return false;
  if (!coupon.endsAt) return true;
  const end = new Date(coupon.endsAt);
  return Number.isNaN(end.getTime()) || end.getTime() >= now.getTime();
}

/** Descuento sobre un total. Si el total no llega a la compra mínima, no descuenta. Nunca supera el total. */
export function discountFor(coupon: PublicCoupon, total: number): number {
  if (total <= 0 || total < coupon.minTotal) return 0;
  const raw = coupon.type === "percent" ? (total * Math.min(coupon.value, MAX_PERCENT)) / 100 : coupon.value;
  return Math.min(Math.round(raw), total);
}

export function describeCoupon(coupon: PublicCoupon): string {
  const value = coupon.type === "percent" ? `${coupon.value}%` : `$${Math.round(coupon.value).toLocaleString("es-AR")}`;
  const min = coupon.minTotal > 0 ? ` en compras desde $${Math.round(coupon.minTotal).toLocaleString("es-AR")}` : "";
  return `${value} de descuento${min}`;
}
