import { withSearchText } from "@/lib/product-schema";
import { ProductModel } from "@/models/Product";
import type { ImportRow } from "./parse-rows";

const BATCH = 500;

export async function applyImport(plan: { toCreate: ImportRow[]; toUpdate: ImportRow[] }) {
  const lookup = [...new Set(plan.toUpdate.map((r) => r.sku.toLowerCase()))];
  const existing = lookup.length
    ? await ProductModel.find({ sku: { $in: plan.toUpdate.map((r) => r.sku) } }, "sku name brand category subCategory").lean()
    : [];
  const current = new Map(existing.map((p) => [String(p.sku).toLowerCase(), p]));
  const ops: object[] = [];
  for (const item of plan.toCreate) {
    ops.push({ insertOne: { document: withSearchText({ sku: item.sku, ...item.data }) } });
  }
  for (const item of plan.toUpdate) {
    const before = current.get(item.sku.toLowerCase());
    const sku = before?.sku ?? item.sku;
    const merged = { sku, name: before?.name, brand: before?.brand, category: before?.category, subCategory: before?.subCategory, ...item.data };
    ops.push({ updateOne: { filter: { sku }, update: { $set: { ...item.data, searchText: withSearchText(merged).searchText } } } });
  }
  for (let i = 0; i < ops.length; i += BATCH) await ProductModel.bulkWrite(ops.slice(i, i + BATCH) as never, { ordered: false });
  return { created: plan.toCreate.length, updated: plan.toUpdate.length };
}
