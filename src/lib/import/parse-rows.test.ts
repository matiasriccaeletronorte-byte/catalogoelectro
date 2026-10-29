import { describe, expect, it } from "vitest";
import { columnForHeader } from "./columns";
import { parsePrice, parseRows } from "./parse-rows";

describe("columnForHeader", () => {
  it("reconoce encabezados con mayúsculas, tildes y espacios", () => {
    expect(columnForHeader("Precio Efectivo")).toBe("cashPrice");
    expect(columnForHeader("DESCRIPCIÓN")).toBe("description");
    expect(columnForHeader("precio_contado")).toBe("listPrice");
    expect(columnForHeader("columna rara")).toBeUndefined();
  });
});

describe("parsePrice", () => {
  it("números y texto con formato argentino", () => {
    expect(parsePrice(1234.5)).toBe(1234.5);
    expect(parsePrice("1234")).toBe(1234);
    expect(parsePrice("$ 1.234")).toBe(1234);
    expect(parsePrice("1.234,50")).toBe(1234.5);
    expect(parsePrice("1234,5")).toBe(1234.5);
    expect(parsePrice("1234.50")).toBe(1234.5);
    expect(parsePrice("1.234.567")).toBe(1234567);
  });
  it("inválidos devuelven null", () => {
    expect(parsePrice("abc")).toBeNull();
    expect(parsePrice("-5")).toBeNull();
    expect(parsePrice("1.2.3")).toBeNull();
  });
});

describe("parseRows", () => {
  it("fila válida completa", () => {
    const { valid, errors } = parseRows([{ rowNumber: 2, cells: { sku: " A1 ", name: "Heladera", category: "Heladeras", cashPrice: "100", listPrice: "120", available: "sí" } }]);
    expect(errors).toEqual([]);
    expect(valid[0]).toEqual({ rowNumber: 2, sku: "A1", data: { name: "Heladera", category: "Heladeras", cashPrice: 100, listPrice: 120, available: true } });
  });
  it("celdas vacías no se incluyen (no borran datos)", () => {
    const { valid } = parseRows([{ rowNumber: 2, cells: { sku: "A1", name: "", brand: "  ", cashPrice: "" } }]);
    expect(valid[0].data).toEqual({});
  });
  it("sin SKU es error", () => {
    const { errors } = parseRows([{ rowNumber: 5, cells: { name: "X" } }]);
    expect(errors).toEqual([{ rowNumber: 5, message: "Falta el SKU" }]);
  });
  it("SKU repetido en el archivo: la segunda fila es error", () => {
    const { valid, errors } = parseRows([
      { rowNumber: 2, cells: { sku: "A1", name: "Uno" } },
      { rowNumber: 3, cells: { sku: "a1 ", name: "Dos" } }
    ]);
    expect(valid).toHaveLength(1);
    expect(errors).toEqual([{ rowNumber: 3, message: "SKU repetido en el archivo (ya aparece en la fila 2)" }]);
  });
  it("precio inválido es error con el nombre de la columna", () => {
    const { errors } = parseRows([{ rowNumber: 4, cells: { sku: "A1", cashPrice: "abc" } }]);
    expect(errors).toEqual([{ rowNumber: 4, message: "Precio efectivo inválido: \"abc\"" }]);
  });
  it("disponible y outlet aceptan sí/no, 1/0, true/false", () => {
    const { valid } = parseRows([{ rowNumber: 2, cells: { sku: "A", available: "NO", outlet: 1, active: "false" } }]);
    expect(valid[0].data).toEqual({ available: false, outlet: true, active: false });
  });
  it("características separadas por | o ;", () => {
    const { valid } = parseRows([{ rowNumber: 2, cells: { sku: "A", features: "No Frost | 340L; Inverter" } }]);
    expect(valid[0].data.features).toEqual(["No Frost", "340L", "Inverter"]);
  });
});
