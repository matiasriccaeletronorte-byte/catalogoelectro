import { describe, expect, it } from "vitest";
import { describeCoupon, discountFor, isCouponUsable, normalizeCode, type PublicCoupon } from "./coupons";

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
