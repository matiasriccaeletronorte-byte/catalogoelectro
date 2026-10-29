import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildHomeShelves } from "./home-shelves";
import { withSearchText } from "./product-schema";
import { ProductModel } from "@/models/Product";

// Prueba de integración: usa una base de pruebas en MongoDB local. Si no hay Mongo, se omite.
const uri = process.env.MONGODB_TEST_URI || "mongodb://localhost:27017/catalogo_test";
let available = false;

beforeAll(async () => {
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 1500 });
    await ProductModel.syncIndexes();
    available = true;
  } catch {
    available = false;
  }
});
afterAll(async () => { if (available) { await ProductModel.deleteMany({}); await mongoose.disconnect(); } });
beforeEach(async () => { if (available) await ProductModel.deleteMany({}); });

const make = (sku: string, category: string, extra: Record<string, unknown> = {}) =>
  withSearchText({ sku, name: `Artículo ${sku}`, category, cashPrice: 100, listPrice: 120, available: true, active: true, outlet: false, ...extra });

describe("buildHomeShelves (MongoDB)", () => {
  it("toma las categorías con más productos, con un máximo de artículos por fila", async (ctx) => {
    if (!available) return ctx.skip();
    const docs = [
      ...Array.from({ length: 12 }, (_, i) => make(`A${i}`, "Heladeras")),
      ...Array.from({ length: 5 }, (_, i) => make(`B${i}`, "Lavarropas")),
      make("C0", "Cocinas")
    ];
    await ProductModel.insertMany(docs);
    const { categories } = await buildHomeShelves({ categoryCount: 2, perShelf: 10 });
    expect(categories.map((c) => c.name)).toEqual(["Heladeras", "Lavarropas"]);
    expect(categories[0].items).toHaveLength(10);
    expect(categories[0].total).toBe(12);
    expect(categories[1].items).toHaveLength(5);
  });
  it("la fila de outlet solo trae outlet activos", async (ctx) => {
    if (!available) return ctx.skip();
    await ProductModel.insertMany([make("O1", "Heladeras", { outlet: true }), make("O2", "Heladeras", { outlet: true, active: false }), make("N1", "Heladeras")]);
    const { outlet } = await buildHomeShelves({ categoryCount: 6, perShelf: 10 });
    expect(outlet.map((p) => p.sku)).toEqual(["O1"]);
  });
  it("no incluye artículos inactivos en las categorías", async (ctx) => {
    if (!available) return ctx.skip();
    await ProductModel.insertMany([make("X1", "Heladeras", { active: false }), make("X2", "Heladeras")]);
    const { categories } = await buildHomeShelves({ categoryCount: 6, perShelf: 10 });
    expect(categories[0].total).toBe(1);
    expect(categories[0].items.map((p) => p.sku)).toEqual(["X2"]);
  });
  it("sin productos devuelve filas vacías", async (ctx) => {
    if (!available) return ctx.skip();
    expect(await buildHomeShelves({ categoryCount: 6, perShelf: 10 })).toEqual({ outlet: [], categories: [] });
  });
});
