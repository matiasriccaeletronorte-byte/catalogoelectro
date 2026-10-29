import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { runImport } from "./run";
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

const row = (rowNumber: number, cells: Record<string, unknown>) => ({ rowNumber, cells });
const full = { name: "Heladera", category: "Heladeras", cashPrice: 100, listPrice: 120 };

describe("runImport (MongoDB)", () => {
  it("SKU en otro caso actualiza el existente, no crea un duplicado", async (ctx) => {
    if (!available) return ctx.skip();
    await runImport([row(2, { sku: "abc-1", ...full })], "apply");
    const result = await runImport([row(2, { sku: "ABC-1", cashPrice: 5 })], "apply");
    expect(result).toMatchObject({ created: 0, updated: 1 });
    expect(await ProductModel.countDocuments()).toBe(1);
    expect(((await ProductModel.findOne({}).lean()) as { cashPrice?: number } | null)?.cashPrice).toBe(5);
  });
  it("celda vacía y columna ausente no borran datos", async (ctx) => {
    if (!available) return ctx.skip();
    await runImport([row(2, { sku: "A1", brand: "LG", ...full })], "apply");
    await runImport([row(2, { sku: "A1", name: "", brand: "  ", cashPrice: 90 })], "apply");
    const p = await ProductModel.findOne({ sku: "A1" }).lean();
    expect(p).toMatchObject({ name: "Heladera", brand: "LG", cashPrice: 90, listPrice: 120 });
  });
  it("actualizar mantiene la búsqueda al día", async (ctx) => {
    if (!available) return ctx.skip();
    await runImport([row(2, { sku: "A1", ...full })], "apply");
    await runImport([row(2, { sku: "A1", brand: "Samsung" })], "apply");
    expect(((await ProductModel.findOne({ sku: "A1" }).lean()) as { searchText?: string } | null)?.searchText).toContain("samsung");
  });
  it("vista previa no escribe", async (ctx) => {
    if (!available) return ctx.skip();
    const result = await runImport([row(2, { sku: "A1", ...full })], "preview");
    expect(result.created).toBe(1);
    expect(await ProductModel.countDocuments()).toBe(0);
  });
  it("la vista previa y el apply informan el mismo plan", async (ctx) => {
    if (!available) return ctx.skip();
    const rows = [row(2, { sku: "A1", ...full }), row(3, { sku: "A2", name: "X" })];
    const preview = await runImport(rows, "preview");
    const applied = await runImport(rows, "apply");
    expect([applied.created, applied.errors.length]).toEqual([preview.created, preview.errors.length]);
    expect(applied.errors[0].rowNumber).toBe(3);
  });
});
