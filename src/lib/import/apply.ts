import { Types } from "mongoose";
import { ensurePath, loadNodes } from "@/lib/category-store";
import { derivedFields, normalizeName } from "@/lib/category-tree";
import { skuKeyOf, withSearchText } from "@/lib/product-schema";
import { ProductModel } from "@/models/Product";
import { importPathNames } from "./category-path";
import type { ImportRow, ProductFields } from "./parse-rows";

const BATCH = 500;

export class ImportConflictError extends Error {}

export async function applyImport(plan: { toCreate: ImportRow[]; toUpdate: ImportRow[] }) {
  const keys = [...new Set(plan.toUpdate.map((r) => skuKeyOf(r.sku)))];
  const existing = keys.length ? await ProductModel.find({ skuKey: { $in: keys } }, "sku skuKey name brand category subCategory").lean() : [];
  const current = new Map(existing.map((p) => [String(p.skuKey), p]));

  // las categorías se resuelven una sola vez por camino (se crean las que falten)
  const nodes = await loadNodes();
  const resolved = new Map<string, Awaited<ReturnType<typeof ensurePath>>>();
  const categoryData = async (data: Partial<ProductFields>) => {
    const names = importPathNames(data);
    if (!names || names.length === 0) return {};
    const key = names.map(normalizeName).join(">");
    let path = resolved.get(key);
    if (!path) { path = await ensurePath(names, nodes); resolved.set(key, path); }
    return { categoryId: new Types.ObjectId(path[path.length - 1].id), categoryPath: path.map((node) => new Types.ObjectId(node.id)), ...derivedFields(path) };
  };

  const ops: object[] = [];
  for (const item of plan.toCreate) {
    ops.push({ insertOne: { document: withSearchText({ sku: item.sku, ...item.data, ...(await categoryData(item.data)) }) } });
  }
  for (const item of plan.toUpdate) {
    const before = current.get(skuKeyOf(item.sku));
    const sku = before?.sku ?? item.sku;
    const extra = await categoryData(item.data);
    const merged = { sku, name: before?.name, brand: before?.brand, category: before?.category, subCategory: before?.subCategory, ...item.data, ...extra };
    ops.push({ updateOne: { filter: { skuKey: skuKeyOf(sku) }, update: { $set: { ...item.data, ...extra, searchText: withSearchText(merged).searchText } } } });
  }
  try {
    for (let i = 0; i < ops.length; i += BATCH) await ProductModel.bulkWrite(ops.slice(i, i + BATCH) as never, { ordered: false });
  } catch (error) {
    if ((error as { code?: number }).code === 11000) throw new ImportConflictError("Hubo un conflicto de SKU mientras se importaba (otro cambio simultáneo). Parte del archivo puede haberse aplicado: volvé a subirlo para completar.");
    throw error;
  }
  return { created: plan.toCreate.length, updated: plan.toUpdate.length };
}
