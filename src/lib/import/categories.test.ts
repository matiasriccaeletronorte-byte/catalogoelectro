import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { CategoryNodeModel } from "@/models/CategoryNode";
import { ProductModel } from "@/models/Product";
import { loadNodes } from "@/lib/category-store";
import { runImport } from "./run";

// Prueba de integración con MongoDB local; se omite si no hay Mongo.
const uri = process.env.MONGODB_TEST_URI || "mongodb://localhost:27017/catalogo_test";
let available = false;
beforeAll(async () => {
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 1500 });
    await Promise.all([ProductModel.syncIndexes(), CategoryNodeModel.syncIndexes()]);
    available = true;
  } catch { available = false; }
});
afterAll(async () => { if (available) { await clean(); await mongoose.disconnect(); } });
beforeEach(async () => { if (available) await clean(); });
async function clean() { await Promise.all([ProductModel.deleteMany({}), CategoryNodeModel.deleteMany({})]); }

const row = (rowNumber: number, cells: Record<string, unknown>) => ({ rowNumber, cells });
const base = { name: "Aire Split 3000", cashPrice: 100, listPrice: 120 };

describe("importación con caminos de categoría", () => {
  it("crea las categorías y deja camino y copias derivadas en el artículo", async (ctx) => {
    if (!available) return ctx.skip();
    const result = await runImport([row(2, { sku: "A1", ...base, category: "Climatización > Aires acondicionados > Split" })], "apply");
    expect(result).toMatchObject({ created: 1, errors: [] });
    expect(result.newCategories).toEqual(["Climatización", "Climatización > Aires acondicionados", "Climatización > Aires acondicionados > Split"]);
    const product = await ProductModel.findOne({ sku: "A1" }).lean() as unknown as { category: string; subCategory: string; categoryPath: unknown[]; searchText: string };
    expect(product.category).toBe("Climatización");
    expect(product.subCategory).toBe("Aires acondicionados");
    expect(product.categoryPath).toHaveLength(3);
    expect(product.searchText).toContain("aires acondicionados");
    expect(await loadNodes()).toHaveLength(3);
  });

  it("la vista previa informa las categorías nuevas y no crea nada", async (ctx) => {
    if (!available) return ctx.skip();
    const result = await runImport([row(2, { sku: "A1", ...base, category: "Hogar > Bazar" })], "preview");
    expect(result.newCategories).toEqual(["Hogar", "Hogar > Bazar"]);
    expect(await loadNodes()).toHaveLength(0);
    expect(await ProductModel.countDocuments()).toBe(0);
  });

  it("tildes, mayúsculas y espacios distintos usan el mismo nodo", async (ctx) => {
    if (!available) return ctx.skip();
    await runImport([row(2, { sku: "A1", ...base, category: "Climatización > Aires" })], "apply");
    const result = await runImport([row(2, { sku: "A2", ...base, category: "  CLIMATIZACION  >  aires " })], "apply");
    expect(result.newCategories).toEqual([]);
    expect(await loadNodes()).toHaveLength(2);
  });

  it("sigue aceptando categoría y subcategoría en columnas separadas", async (ctx) => {
    if (!available) return ctx.skip();
    await runImport([row(2, { sku: "A1", ...base, category: "Hogar", subCategory: "Bazar" })], "apply");
    const product = await ProductModel.findOne({ sku: "A1" }).lean() as unknown as { category: string; subCategory: string };
    expect(product).toMatchObject({ category: "Hogar", subCategory: "Bazar" });
  });

  it("actualizar sin traer categoría no la toca", async (ctx) => {
    if (!available) return ctx.skip();
    await runImport([row(2, { sku: "A1", ...base, category: "Hogar > Bazar" })], "apply");
    await runImport([row(2, { sku: "A1", cashPrice: 5 })], "apply");
    const product = await ProductModel.findOne({ sku: "A1" }).lean() as unknown as { category: string; subCategory: string; cashPrice: number; categoryPath: unknown[] };
    expect(product).toMatchObject({ category: "Hogar", subCategory: "Bazar", cashPrice: 5 });
    expect(product.categoryPath).toHaveLength(2);
  });

  it("caminos raros: error de fila claro y nunca crea categorías vacías", async (ctx) => {
    if (!available) return ctx.skip();
    const result = await runImport([
      row(2, { sku: "B1", ...base, category: ">" }),
      row(3, { sku: "B2", ...base, category: "A" }),
      row(4, { sku: "B3", ...base, category: "x".repeat(61) }),
      row(5, { sku: "B4", ...base, category: "Hogar >  > Bazar" }),
      row(6, { sku: "B5", ...base, subCategory: "Bazar" })
    ], "apply");
    expect(result.errors.map((e) => e.rowNumber)).toEqual([2, 3, 4, 6]);
    expect(result.created).toBe(1);
    const names = (await loadNodes()).map((n) => n.name).sort();
    expect(names).toEqual(["Bazar", "Hogar"]);
  });
});
