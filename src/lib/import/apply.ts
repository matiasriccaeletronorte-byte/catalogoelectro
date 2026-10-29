import { skuKeyOf, withSearchText } from "@/lib/product-schema";
import { ProductModel } from "@/models/Product";
import type { ImportRow } from "./parse-rows";

const BATCH = 500;

export class ImportConflictError extends Error {}

export async function applyImport(plan: { toCreate: ImportRow[]; toUpdate: ImportRow[] }) {
  const keys = [...new Set(plan.toUpdate.map((r) => skuKeyOf(r.sku)))];
  const existing = keys.length ? await ProductModel.find({ skuKey: { $in: keys } }, "sku skuKey name brand category subCategory").lean() : [];
  const current = new Map(existing.map((p) => [String(p.skuKey), p]));
  const ops: object[] = [];
  for (const item of plan.toCreate) {
    ops.push({ insertOne: { document: withSearchText({ sku: item.sku, ...item.data }) } });
  }
  for (const item of plan.toUpdate) {
    const before = current.get(skuKeyOf(item.sku));
    const sku = before?.sku ?? item.sku;
    const merged = { sku, name: before?.name, brand: before?.brand, category: before?.category, subCategory: before?.subCategory, ...item.data };
    ops.push({ updateOne: { filter: { skuKey: skuKeyOf(sku) }, update: { $set: { ...item.data, searchText: withSearchText(merged).searchText } } } });
  }
  try {
    for (let i = 0; i < ops.length; i += BATCH) await ProductModel.bulkWrite(ops.slice(i, i + BATCH) as never, { ordered: false });
  } catch (error) {
    if ((error as { code?: number }).code === 11000) throw new ImportConflictError("Hubo un conflicto de SKU mientras se importaba (otro cambio simultáneo). Parte del archivo puede haberse aplicado: volvé a subirlo para completar.");
    throw error;
  }
  return { created: plan.toCreate.length, updated: plan.toUpdate.length };
}
