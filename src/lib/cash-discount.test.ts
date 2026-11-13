import { describe, expect, it } from "vitest";
import { cashFromDiscount, impliedDiscount } from "./cash-discount";

describe("cashFromDiscount", () => {
  it("descuento porcentual", () => {
    expect(cashFromDiscount(158000, "percent", 15)).toBe(134300);
    expect(cashFromDiscount(100000, "percent", 10)).toBe(90000);
  });
  it("descuento en monto fijo", () => {
    expect(cashFromDiscount(158000, "amount", 8000)).toBe(150000);
  });
  it("redondea a pesos enteros", () => {
    expect(cashFromDiscount(33333, "percent", 15)).toBe(28333);
  });
  it("nunca baja de cero", () => {
    expect(cashFromDiscount(1000, "amount", 5000)).toBe(0);
    expect(cashFromDiscount(1000, "percent", 150)).toBe(0);
  });
  it("sin descuento deja el precio de contado", () => {
    expect(cashFromDiscount(50000, "percent", 0)).toBe(50000);
    expect(cashFromDiscount(0, "percent", 15)).toBe(0);
  });
});

describe("impliedDiscount", () => {
  it("calcula monto y porcentaje", () => {
    expect(impliedDiscount(158000, 134300)).toEqual({ amount: 23700, percent: 15 });
  });
  it("sin descuento si el efectivo no es menor", () => {
    expect(impliedDiscount(1000, 1000)).toBeNull();
    expect(impliedDiscount(1000, 1200)).toBeNull();
    expect(impliedDiscount(0, 500)).toBeNull();
  });
});
