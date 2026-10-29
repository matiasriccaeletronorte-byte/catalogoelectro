import { skuKeyOf } from "@/lib/product-schema";
import { ProductModel } from "@/models/Product";
import { applyImport } from "./apply";
import { parseRows, RawRow, RowError } from "./parse-rows";
import { planImport } from "./plan";

export type ImportResult = { mode: "preview" | "apply"; created: number; updated: number; errors: RowError[] };

export async function runImport(rows: RawRow[], mode: "preview" | "apply"): Promise<ImportResult> {
  const { valid, errors: rowErrors } = parseRows(rows);
  const existing = await ProductModel.find({ skuKey: { $in: valid.map((r) => skuKeyOf(r.sku)) } }, "sku").lean();
  const plan = planImport(valid, new Set(existing.map((p) => String(p.sku))));
  const errors = [...rowErrors, ...plan.errors].sort((a, b) => a.rowNumber - b.rowNumber);
  const counts = mode === "apply" ? await applyImport(plan) : { created: plan.toCreate.length, updated: plan.toUpdate.length };
  return { mode, ...counts, errors };
}
