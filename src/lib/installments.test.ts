import { describe, expect, it } from "vitest";
import { activePromos, argentinaYmd, installmentValue, nextPromo } from "./installments";

// 15:00 UTC = 12:00 en Argentina
const at = (ymd: string) => new Date(`${ymd}T15:00:00Z`);
const ids = (date: Date, bbva: string[] = []) => activePromos(date, bbva).map((p) => p.id);

describe("activePromos", () => {
  it("miércoles: 3 cuotas y 6 con Hipotecario", () => {
    expect(ids(at("2026-10-28"))).toEqual(["cuotas3", "hipotecario6"]);
  });
  it("sábado: solo 3 cuotas", () => {
    expect(ids(at("2026-10-31"))).toEqual(["cuotas3"]);
  });
  it("jueves: sin promos", () => {
    expect(ids(at("2026-10-29"))).toEqual([]);
  });
  it("día BBVA cargado: 6 cuotas con BBVA", () => {
    expect(ids(at("2026-11-12"), ["2026-11-12"])).toEqual(["bbva6"]);
  });
  it("día BBVA que cae miércoles suma las tres promos", () => {
    expect(ids(at("2026-10-28"), ["2026-10-28"])).toEqual(["cuotas3", "hipotecario6", "bbva6"]);
  });
  it("usa el día argentino aunque en UTC ya sea el día siguiente", () => {
    // 02:30 UTC del jueves = miércoles 23:30 en Argentina
    expect(ids(new Date("2026-10-29T02:30:00Z"))).toEqual(["cuotas3", "hipotecario6"]);
  });
});

describe("argentinaYmd", () => {
  it("devuelve la fecha argentina", () => {
    expect(argentinaYmd(new Date("2026-10-29T02:30:00Z"))).toBe("2026-10-28");
  });
});

describe("nextPromo", () => {
  it("un jueves, la próxima es el sábado", () => {
    expect(nextPromo(at("2026-10-29"), [])).toEqual({ label: "sábado", daysAhead: 2 });
  });
  it("considera el día BBVA si llega antes", () => {
    expect(nextPromo(at("2026-10-29"), ["2026-10-30"])).toEqual({ label: "viernes", daysAhead: 1 });
  });
  it("hoy hay promo: devuelve null", () => {
    expect(nextPromo(at("2026-10-28"), [])).toBeNull();
  });
});

describe("installmentValue", () => {
  it("divide y redondea", () => {
    expect(installmentValue(100000, 3)).toBe(33333);
    expect(installmentValue(100000, 6)).toBe(16667);
  });
});
