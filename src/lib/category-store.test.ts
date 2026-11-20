import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { CategoryModel } from "@/models/Category";
import { CategoryNodeModel } from "@/models/CategoryNode";
import { ProductModel } from "@/models/Product";
import {
  categoryFieldsFor, CategoryError, convertLegacy, countsByNode, createNode, deleteNode, ensurePath, legacyProductCount,
  loadNodes, moveNode, moveProducts, renameNode
} from "./category-store";

// Prueba de integración: usa una base de pruebas en MongoDB local. Si no hay Mongo, se omite.
const uri = process.env.MONGODB_TEST_URI || "mongodb://localhost:27017/catalogo_test";
let available = false;

beforeAll(async () => {
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 1500 });
    await Promise.all([ProductModel.syncIndexes(), CategoryNodeModel.syncIndexes()]);
    available = true;
  } catch {
    available = false;
  }
});
afterAll(async () => { if (available) { await clean(); await mongoose.disconnect(); } });
beforeEach(async () => { if (available) await clean(); });
async function clean() { await Promise.all([ProductModel.deleteMany({}), CategoryNodeModel.deleteMany({}), CategoryModel.deleteMany({})]); }

let counter = 0;
async function product(fields: Record<string, unknown> = {}) {
  counter += 1;
  return ProductModel.create({ sku: `S${counter}`, skuKey: `s${counter}`, name: `Artículo ${counter}`, cashPrice: 1, listPrice: 2, category: "Sin", ...fields });
}
async function assign(id: string, path: string[]) {
  const nodes = await loadNodes();
  const fields = await categoryFieldsFor(id);
  void nodes;
  return ProductModel.create({ sku: path.join("-") + (counter += 1), skuKey: path.join("-").toLowerCase() + counter, name: "Producto", cashPrice: 1, listPrice: 2, ...fields });
}

describe("createNode", () => {
  it("crea con dirección y rechaza duplicados sin distinguir tildes ni mayúsculas", async (ctx) => {
    if (!available) return ctx.skip();
    const root = await createNode(null, "  Climatización ");
    expect(root).toMatchObject({ name: "Climatización", slug: "climatizacion", parentId: null });
    await expect(createNode(null, "CLIMATIZACION")).rejects.toMatchObject({ code: "duplicate" });
    const child = await createNode(root.id, "Aires");
    expect(child.parentId).toBe(root.id);
  });
  it("el mismo nombre en distinto nivel es válido", async (ctx) => {
    if (!available) return ctx.skip();
    const a = await createNode(null, "Hogar");
    await createNode(null, "Cocina");
    await expect(createNode(a.id, "Cocina")).resolves.toMatchObject({ name: "Cocina" });
  });
  it("valida el largo y el padre", async (ctx) => {
    if (!available) return ctx.skip();
    await expect(createNode(null, "A")).rejects.toMatchObject({ code: "invalid" });
    await expect(createNode("a".repeat(24), "Algo")).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("renameNode", () => {
  it("renombra y actualiza category/subCategory y búsqueda de los artículos de la rama", async (ctx) => {
    if (!available) return ctx.skip();
    const root = await createNode(null, "Climatizacion");
    const sub = await createNode(root.id, "Aires");
    await assign(sub.id, ["Climatizacion", "Aires"]);
    await renameNode(root.id, "Climatización");
    const found = await ProductModel.findOne({ categoryId: sub.id }).lean() as unknown as Record<string, string>;
    expect(found.category).toBe("Climatización");
    expect(found.subCategory).toBe("Aires");
    expect(found.searchText).toContain("climatizacion");
    expect((await loadNodes()).find((n) => n.id === root.id)?.slug).toBe("climatizacion");
  });
  it("rechaza un nombre que ya usa un hermano", async (ctx) => {
    if (!available) return ctx.skip();
    const a = await createNode(null, "Hogar");
    await createNode(null, "Bazar");
    await expect(renameNode(a.id, "bazar")).rejects.toMatchObject({ code: "duplicate" });
  });
});

describe("moveNode", () => {
  it("mueve la rama y recalcula el camino de los artículos", async (ctx) => {
    if (!available) return ctx.skip();
    const clima = await createNode(null, "Climatización");
    const hogar = await createNode(null, "Hogar");
    const aires = await createNode(clima.id, "Aires");
    const split = await createNode(aires.id, "Split");
    await assign(split.id, ["Climatización", "Aires", "Split"]);
    await moveNode(aires.id, hogar.id);
    const found = await ProductModel.findOne({ categoryId: split.id }).lean() as unknown as { category: string; subCategory: string; categoryPath: unknown[] };
    expect(found.category).toBe("Hogar");
    expect(found.subCategory).toBe("Aires");
    expect(found.categoryPath.map(String)).toEqual([hogar.id, aires.id, split.id]);
  });
  it("rechaza mover dentro de sí misma o de una subcategoría suya y no cambia nada", async (ctx) => {
    if (!available) return ctx.skip();
    const root = await createNode(null, "Climatización");
    const child = await createNode(root.id, "Aires");
    await expect(moveNode(root.id, root.id)).rejects.toMatchObject({ code: "cycle" });
    await expect(moveNode(root.id, child.id)).rejects.toMatchObject({ code: "cycle" });
    const nodes = await loadNodes();
    expect(nodes.find((n) => n.id === root.id)?.parentId).toBeNull();
  });
  it("rechaza si el destino ya tiene una categoría con ese nombre", async (ctx) => {
    if (!available) return ctx.skip();
    const a = await createNode(null, "Hogar");
    const b = await createNode(null, "Cocina");
    await createNode(a.id, "Cocina");
    await expect(moveNode(b.id, a.id)).rejects.toMatchObject({ code: "duplicate" });
  });
});

describe("deleteNode", () => {
  it("bloquea si tiene subcategorías o artículos y no pierde nada", async (ctx) => {
    if (!available) return ctx.skip();
    const root = await createNode(null, "Climatización");
    const child = await createNode(root.id, "Aires");
    await assign(child.id, ["Climatización", "Aires"]);
    await expect(deleteNode(root.id)).rejects.toMatchObject({ code: "has_children" });
    await expect(deleteNode(child.id)).rejects.toMatchObject({ code: "has_products" });
    expect(await loadNodes()).toHaveLength(2);
    expect(await ProductModel.countDocuments()).toBe(1);
  });
  it("borra una categoría vacía", async (ctx) => {
    if (!available) return ctx.skip();
    const root = await createNode(null, "Vacía");
    await deleteNode(root.id);
    expect(await loadNodes()).toHaveLength(0);
  });
});

describe("moveProducts", () => {
  it("pasa los artículos de una categoría (y sus subcategorías) a otra", async (ctx) => {
    if (!available) return ctx.skip();
    const a = await createNode(null, "Origen");
    const sub = await createNode(a.id, "Sub");
    const b = await createNode(null, "Destino");
    await assign(a.id, ["Origen"]);
    await assign(sub.id, ["Origen", "Sub"]);
    expect(await moveProducts(a.id, b.id)).toBe(2);
    expect(await ProductModel.countDocuments({ categoryId: b.id })).toBe(2);
    const moved = await ProductModel.findOne({ categoryId: b.id }).lean() as unknown as { category: string };
    expect(moved.category).toBe("Destino");
  });
});

describe("ensurePath", () => {
  it("crea lo que falta y reutiliza lo que existe aunque cambien tildes, mayúsculas o espacios", async (ctx) => {
    if (!available) return ctx.skip();
    const first = await ensurePath(["Climatización", "Aires acondicionados", "Split"]);
    const again = await ensurePath(["  CLIMATIZACION ", "aires   acondicionados", "Split"]);
    expect(again.map((n) => n.id)).toEqual(first.map((n) => n.id));
    expect(await loadNodes()).toHaveLength(3);
  });
});

describe("countsByNode / categoryFieldsFor", () => {
  it("cuenta artículos por rama (incluye descendientes) y puede excluir inactivos", async (ctx) => {
    if (!available) return ctx.skip();
    const root = await createNode(null, "Climatización");
    const aires = await createNode(root.id, "Aires");
    await assign(aires.id, ["a"]);
    const inactive = await assign(aires.id, ["b"]);
    await ProductModel.updateOne({ _id: inactive._id }, { active: false });
    expect((await countsByNode(true))[root.id]).toBe(2);
    expect((await countsByNode(false))[root.id]).toBe(1);
    expect((await countsByNode(false))[aires.id]).toBe(1);
  });
  it("categoryFieldsFor devuelve camino y copias derivadas, o null si no existe", async (ctx) => {
    if (!available) return ctx.skip();
    const root = await createNode(null, "Climatización");
    const aires = await createNode(root.id, "Aires");
    const fields = await categoryFieldsFor(aires.id);
    expect(fields).toMatchObject({ category: "Climatización", subCategory: "Aires" });
    expect(fields!.categoryPath.map(String)).toEqual([root.id, aires.id]);
    expect(await categoryFieldsFor("b".repeat(24))).toBeNull();
  });
});

describe("convertLegacy", () => {
  it("convierte las categorías planas y deja todos los artículos con categoryId", async (ctx) => {
    if (!available) return ctx.skip();
    await product({ category: "Cocinas" });
    await product({ category: "Cocinas" });
    await product({ category: "Hogar", subCategory: "Bazar" });
    await CategoryModel.create({ name: "Vacía", subCategories: ["Una"] });
    expect(await legacyProductCount()).toBe(3);
    const result = await convertLegacy();
    expect(result.assigned).toBe(3);
    expect(await legacyProductCount()).toBe(0);
    const names = (await loadNodes()).map((n) => n.name).sort();
    expect(names).toEqual(["Bazar", "Cocinas", "Hogar", "Una", "Vacía"]);
    expect(await ProductModel.countDocuments()).toBe(3);
  });
  it("es idempotente", async (ctx) => {
    if (!available) return ctx.skip();
    await product({ category: "Cocinas" });
    await convertLegacy();
    const again = await convertLegacy();
    expect(again).toEqual({ created: 0, assigned: 0 });
  });
  it("un artículo ya convertido no se toca", async (ctx) => {
    if (!available) return ctx.skip();
    const root = await createNode(null, "Climatización");
    await assign(root.id, ["x"]);
    await convertLegacy();
    expect((await loadNodes())).toHaveLength(1);
  });
});

describe("CategoryError", () => {
  it("lleva el código", () => {
    expect(new CategoryError("cycle", "x").code).toBe("cycle");
  });
});
