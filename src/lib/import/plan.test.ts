import { describe, expect, it } from "vitest";
import { planImport } from "./plan";
import type { ImportRow } from "./parse-rows";

const full = { name: "Heladera", category: "Heladeras", cashPrice: 100, listPrice: 120 };
const row = (rowNumber: number, sku: string, data: ImportRow["data"]): ImportRow => ({ rowNumber, sku, data });

describe("planImport", () => {
  it("SKU existente se actualiza aunque venga incompleto", () => {
    const plan = planImport([row(2, "A1", { cashPrice: 90 })], new Set(["A1"]));
    expect(plan.toUpdate).toHaveLength(1);
    expect(plan.toCreate).toHaveLength(0);
  });
  it("SKU nuevo con todos los campos obligatorios se crea", () => {
    expect(planImport([row(2, "B1", full)], new Set()).toCreate).toHaveLength(1);
  });
  it("SKU nuevo incompleto es error y dice qué falta", () => {
    const plan = planImport([row(3, "B2", { name: "X" })], new Set());
    expect(plan.toCreate).toHaveLength(0);
    expect(plan.errors).toEqual([{ rowNumber: 3, message: "Artículo nuevo: faltan Categoría, Precio efectivo, Precio contado" }]);
  });
  it("la comparación de SKU no distingue mayúsculas", () => {
    expect(planImport([row(2, "a1", { cashPrice: 1 })], new Set(["A1"])).toUpdate).toHaveLength(1);
  });
});
