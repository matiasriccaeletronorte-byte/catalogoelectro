import { describe, expect, it } from "vitest";
import { couponCovers, describeCoupon, discountFor, endsAtFromMinutes, isCouponUsable, normalizeCode, timeLeftLabel, type PublicCoupon } from "./coupons";

const pct = (value: number, minTotal = 0): PublicCoupon => ({ code: "X", type: "percent", value, minTotal });
const fixed = (value: number, minTotal = 0): PublicCoupon => ({ code: "X", type: "fixed", value, minTotal });

describe("coupons", () => {
  it("normaliza el código: mayúsculas, sin espacios ni símbolos", () => {
    expect(normalizeCode(" verano-10 ")).toBe("VERANO-10");
    expect(normalizeCode("ñandú!%")).toBe("NANDU");
  });
  it("descuento porcentual y fijo", () => {
    expect(discountFor(pct(10), 1000)).toBe(100);
    expect(discountFor(fixed(300), 1000)).toBe(300);
  });
  it("el fijo nunca supera el total", () => {
    expect(discountFor(fixed(5000), 1000)).toBe(1000);
  });
  it("no descuenta si no llega a la compra mínima", () => {
    expect(discountFor(pct(10, 2000), 1999)).toBe(0);
    expect(discountFor(pct(10, 2000), 2000)).toBe(200);
  });
  it("tope de porcentaje y total vacío", () => {
    expect(discountFor(pct(100), 1000)).toBe(900);
    expect(discountFor(pct(10), 0)).toBe(0);
  });
  it("vigencia: inactivo, vencido y sin fecha", () => {
    const now = new Date("2026-11-10T12:00:00Z");
    expect(isCouponUsable({ active: false }, now)).toBe(false);
    expect(isCouponUsable({ active: true }, now)).toBe(true);
    expect(isCouponUsable({ active: true, endsAt: "2026-11-09T00:00:00Z" }, now)).toBe(false);
    expect(isCouponUsable({ active: true, endsAt: "2026-11-11T00:00:00Z" }, now)).toBe(true);
  });
  it("describe el cupón", () => {
    expect(describeCoupon(pct(15))).toBe("15% de descuento");
    expect(describeCoupon(fixed(5000, 50000))).toContain("desde $50.000");
  });
});

describe("cupones con lista de artículos", () => {
  it("sin lista (o vacía) aplica a todos los artículos", () => {
    expect(couponCovers(pct(10), "a")).toBe(true);
    expect(couponCovers({ ...pct(10), productIds: [] }, "a")).toBe(true);
  });
  it("con lista aplica solo a esos artículos", () => {
    const coupon = { ...pct(10), productIds: ["a", "b"] };
    expect(couponCovers(coupon, "a")).toBe(true);
    expect(couponCovers(coupon, "z")).toBe(false);
  });
});

describe("cupones con temporizador", () => {
  const now = new Date("2026-11-20T12:00:00Z");
  it("calcula el vencimiento a partir de los minutos desde ahora", () => {
    expect(endsAtFromMinutes(60, now).toISOString()).toBe("2026-11-20T13:00:00.000Z");
    expect(endsAtFromMinutes(30, now).toISOString()).toBe("2026-11-20T12:30:00.000Z");
  });
  it("un cupón vencido por tiempo deja de ser usable", () => {
    const endsAt = endsAtFromMinutes(60, now);
    expect(isCouponUsable({ active: true, endsAt }, new Date("2026-11-20T12:59:59Z"))).toBe(true);
    expect(isCouponUsable({ active: true, endsAt }, new Date("2026-11-20T13:00:01Z"))).toBe(false);
  });
  it("describe el tiempo que queda", () => {
    const at = (min: number) => new Date(now.getTime() + min * 60_000);
    expect(timeLeftLabel(at(58), now)).toBe("58 min");
    expect(timeLeftLabel(at(65), now)).toBe("1 h 5 min");
    expect(timeLeftLabel(at(120), now)).toBe("2 h");
    expect(timeLeftLabel(new Date(now.getTime() + 20_000), now)).toBe("menos de 1 min");
    expect(timeLeftLabel(at(-1), now)).toBe("vencido");
    expect(timeLeftLabel(null, now)).toBe("");
  });
});
