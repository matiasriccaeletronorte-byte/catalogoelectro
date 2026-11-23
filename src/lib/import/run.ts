import { loadNodes } from "@/lib/category-store";
import { missingPaths } from "@/lib/category-tree";
import { skuKeyOf } from "@/lib/product-schema";
import { ProductModel } from "@/models/Product";
import { applyImport } from "./apply";
import { importPathNames } from "./category-path";
import { parseRows, RawRow, RowError } from "./parse-rows";
import { planImport, type UpdateChoice } from "./plan";

export type ImportResult = { mode: "preview" | "apply"; created: number; updated: number; errors: RowError[]; newCategories: string[] };

export async function runImport(rows: RawRow[], mode: "preview" | "apply", update: UpdateChoice = "all"): Promise<ImportResult> {
  const { valid, errors: rowErrors } = parseRows(rows);
  const existing = await ProductModel.find({ skuKey: { $in: valid.map((r) => skuKeyOf(r.sku)) } }, "sku").lean();
  const plan = planImport(valid, new Set(existing.map((p) => String(p.sku))), update);
  const errors = [...rowErrors, ...plan.errors].sort((a, b) => a.rowNumber - b.rowNumber);
  const wanted = [...plan.toCreate, ...plan.toUpdate].map((item) => importPathNames(item.data)).filter((names): names is string[] => !!names && names.length > 0);
  const newCategories = missingPaths(await loadNodes(), wanted);
  const counts = mode === "apply" ? await applyImport(plan) : { created: plan.toCreate.length, updated: plan.toUpdate.length };
  return { mode, ...counts, errors, newCategories };
}
