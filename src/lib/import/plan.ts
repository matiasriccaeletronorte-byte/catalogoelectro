import type { ImportRow, ProductFields, RowError } from "./parse-rows";

const REQUIRED: [keyof ProductFields, string][] = [["name", "Nombre"], ["category", "Categoría"], ["cashPrice", "Precio efectivo"], ["listPrice", "Precio contado"]];

export function planImport(valid: ImportRow[], existingSkus: Set<string>): { toCreate: ImportRow[]; toUpdate: ImportRow[]; errors: RowError[] } {
  const existing = new Set([...existingSkus].map((s) => s.toLowerCase()));
  const toCreate: ImportRow[] = [], toUpdate: ImportRow[] = [], errors: RowError[] = [];
  for (const item of valid) {
    if (existing.has(item.sku.toLowerCase())) { toUpdate.push(item); continue; }
    const missing = REQUIRED.filter(([field]) => item.data[field] === undefined).map(([, label]) => label);
    if (missing.length > 0) errors.push({ rowNumber: item.rowNumber, message: `Artículo nuevo: faltan ${missing.join(", ")}` });
    else toCreate.push(item);
  }
  return { toCreate, toUpdate, errors };
}
