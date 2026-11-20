export type CouponType = "percent" | "fixed";

/** Lo que el cliente necesita para aplicar un cupón; nunca incluye datos internos. */
export type PublicCoupon = {
  code: string; type: CouponType; value: number; minTotal: number;
  /** Artículos a los que aplica; sin lista (o vacía) aplica a todos. */
  productIds?: string[];
  /** Vencimiento (ISO), para mostrar cuánto falta. La validez la decide siempre el servidor. */
  endsAt?: string | null;
};

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

/** El cupón aplica a este artículo según su lista (sin lista, a todos). */
export const couponCovers = (coupon: Pick<PublicCoupon, "productIds">, productId: string): boolean =>
  !coupon.productIds || coupon.productIds.length === 0 || coupon.productIds.includes(productId);

/** Vencimiento de un cupón activado ahora por una cantidad de minutos. */
export const endsAtFromMinutes = (minutes: number, now = new Date()): Date => new Date(now.getTime() + minutes * 60_000);

/** Tiempo que le queda a un cupón, para mostrar ("58 min", "1 h 5 min"). Vacío si no vence. */
export function timeLeftLabel(endsAt: Date | string | null | undefined, now = new Date()): string {
  if (!endsAt) return "";
  const ms = new Date(endsAt).getTime() - now.getTime();
  if (Number.isNaN(ms)) return "";
  if (ms <= 0) return "vencido";
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "menos de 1 min";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${minutes} min`;
  if (hours >= 24) return `${Math.floor(hours / 24)} d ${hours % 24} h`.replace(" 0 h", "");
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}
