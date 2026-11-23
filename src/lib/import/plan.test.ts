import { describe, expect, it } from "vitest";
import { planImport, parseUpdateGroups } from "./plan";
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

describe("qué campos se actualizan en los artículos que ya existen", () => {
  const item = { rowNumber: 2, sku: "A1", data: { name: "Nuevo nombre", description: "D", category: "Hogar > Bazar", brand: "LG", cashPrice: 90, listPrice: 100, outlet: true } };
  const existing = new Set(["A1"]);
  it("sin elegir grupos (o con 'all') se actualiza todo, como siempre", () => {
    expect(planImport([item], existing).toUpdate[0].data).toEqual(item.data);
    expect(planImport([item], existing, "all").toUpdate[0].data).toEqual(item.data);
  });
  it("con una lista vacía no se toca ningún artículo existente", () => {
    expect(planImport([item], existing, []).toUpdate).toEqual([]);
  });
  it("solo se actualizan los grupos elegidos", () => {
    expect(planImport([item], existing, ["category"]).toUpdate[0].data).toEqual({ category: "Hogar > Bazar" });
    expect(planImport([item], existing, ["prices", "brand"]).toUpdate[0].data).toEqual({ brand: "LG", cashPrice: 90, listPrice: 100 });
    expect(planImport([item], existing, ["other"]).toUpdate[0].data).toEqual({ outlet: true });
  });
  it("una fila sin campos que actualizar se descarta", () => {
    expect(planImport([{ ...item, data: { name: "X" } }], existing, ["prices"]).toUpdate).toEqual([]);
  });
  it("los artículos nuevos se crean completos aunque no se actualice nada", () => {
    const fresh = { rowNumber: 3, sku: "NUEVO", data: { name: "N", category: "Hogar", cashPrice: 1, listPrice: 2 } };
    expect(planImport([fresh], existing, []).toCreate).toHaveLength(1);
  });
  it("parseUpdateGroups: ausente = todo, vacío = nada, ignora grupos desconocidos", () => {
    expect(parseUpdateGroups(null)).toBe("all");
    expect(parseUpdateGroups("")).toEqual([]);
    expect(parseUpdateGroups("prices,category,otra")).toEqual(["prices", "category"]);
  });
});
