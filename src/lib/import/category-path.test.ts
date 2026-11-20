import { describe, expect, it } from "vitest";
import { importPathNames } from "./category-path";

describe("importPathNames", () => {
  it("camino completo con >", () => {
    expect(importPathNames({ category: "Climatización > Aires acondicionados > Split" })).toEqual(["Climatización", "Aires acondicionados", "Split"]);
  });
  it("categoría y subcategoría en columnas separadas (como antes)", () => {
    expect(importPathNames({ category: "Hogar", subCategory: "Bazar" })).toEqual(["Hogar", "Bazar"]);
  });
  it("si la categoría ya trae >, ignora la columna de subcategoría", () => {
    expect(importPathNames({ category: "A > B", subCategory: "C" })).toEqual(["A", "B"]);
  });
  it("espacios de más y segmentos vacíos", () => {
    expect(importPathNames({ category: "  Hogar  " })).toEqual(["Hogar"]);
    expect(importPathNames({ category: "A >  > B" })).toEqual(["A", "B"]);
    expect(importPathNames({ category: ">" })).toEqual([]);
  });
  it("sin categoría devuelve null", () => {
    expect(importPathNames({})).toBeNull();
    expect(importPathNames({ subCategory: "Bazar" })).toBeNull();
  });
});
