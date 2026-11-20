import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { BrandModel } from "@/models/Brand";
import { ProductModel } from "@/models/Product";
import { removeBrand } from "./taxonomy";

// Prueba de integración: usa una base de pruebas en MongoDB local. Si no hay Mongo, se omite.
const uri = process.env.MONGODB_TEST_URI || "mongodb://localhost:27017/catalogo_test";
let available = false;
beforeAll(async () => { try { await mongoose.connect(uri, { serverSelectionTimeoutMS: 1500 }); available = true; } catch { available = false; } });
afterAll(async () => { if (available) { await clean(); await mongoose.disconnect(); } });
beforeEach(async () => { if (available) await clean(); });
const clean = () => Promise.all([ProductModel.deleteMany({}), BrandModel.deleteMany({})]);
const product = (sku: string, brand: string) => ProductModel.create({ sku, skuKey: sku, name: `Artículo ${sku}`, brand, category: "Hogar", cashPrice: 1, listPrice: 1, searchText: `${sku} ${brand}` });

describe("removeBrand", () => {
  it("una marca sin artículos se elimina sin más", async (ctx) => {
    if (!available) return ctx.skip();
    await BrandModel.create({ name: "Vacía" });
    expect(await removeBrand("Vacía", false)).toEqual({ ok: true, cleared: 0 });
    expect(await BrandModel.countDocuments()).toBe(0);
  });
  it("con artículos y sin confirmación avisa cuántos hay y no toca nada", async (ctx) => {
    if (!available) return ctx.skip();
    await BrandModel.create({ name: "Whirlpool" });
    await product("a", "Whirlpool");
    expect(await removeBrand("Whirlpool", false)).toEqual({ ok: false, count: 1 });
    expect(await BrandModel.countDocuments()).toBe(1);
    expect(await ProductModel.countDocuments({ brand: "Whirlpool" })).toBe(1);
  });
  it("confirmando, los artículos quedan sin marca (no se borran) y las demás marcas no cambian", async (ctx) => {
    if (!available) return ctx.skip();
    await BrandModel.create({ name: "Whirlpool" });
    await product("a", "Whirlpool"); await product("b", "Philco");
    expect(await removeBrand("Whirlpool", true)).toEqual({ ok: true, cleared: 1 });
    expect(await ProductModel.countDocuments()).toBe(2);
    expect(await ProductModel.countDocuments({ brand: "" })).toBe(1);
    expect(await ProductModel.countDocuments({ brand: "Philco" })).toBe(1);
    const cleared = (await ProductModel.findOne({ sku: "a" }).lean()) as { searchText?: string } | null;
    expect(cleared?.searchText).not.toMatch(/whirlpool/i);
    expect(await BrandModel.countDocuments()).toBe(0);
  });
});
