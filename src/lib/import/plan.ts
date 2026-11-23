import type { ImportRow, ProductFields, RowError } from "./parse-rows";

const REQUIRED: [keyof ProductFields, string][] = [["name", "Nombre"], ["category", "Categoría"], ["cashPrice", "Precio efectivo"], ["listPrice", "Precio contado"]];

/** Grupos de campos que se pueden actualizar en los artículos que ya existen. Las fotos nunca se tocan. */
export const UPDATE_FIELDS = {
  name: ["name"],
  description: ["description"],
  category: ["category", "subCategory"],
  brand: ["brand"],
  prices: ["cashPrice", "listPrice"],
  other: ["features", "available", "outlet", "active"]
} as const satisfies Record<string, (keyof ProductFields)[]>;
export type UpdateGroup = keyof typeof UPDATE_FIELDS;
export type UpdateChoice = "all" | UpdateGroup[];

/** Lee la elección del formulario: sin dato, se actualiza todo (como siempre); vacío, nada; si no, la lista de grupos. */
export function parseUpdateGroups(raw: string | null): UpdateChoice {
  if (raw === null) return "all";
  return raw.split(",").map((g) => g.trim()).filter((g): g is UpdateGroup => g in UPDATE_FIELDS);
}

function restrict(item: ImportRow, update: UpdateChoice): ImportRow | null {
  if (update === "all") return item;
  const allowed = new Set<string>(update.flatMap((group) => UPDATE_FIELDS[group]));
  const data = Object.fromEntries(Object.entries(item.data).filter(([field]) => allowed.has(field))) as ImportRow["data"];
  return Object.keys(data).length > 0 ? { ...item, data } : null;
}

export function planImport(valid: ImportRow[], existingSkus: Set<string>, update: UpdateChoice = "all"): { toCreate: ImportRow[]; toUpdate: ImportRow[]; errors: RowError[] } {
  const existing = new Set([...existingSkus].map((s) => s.toLowerCase()));
  const toCreate: ImportRow[] = [], toUpdate: ImportRow[] = [], errors: RowError[] = [];
  for (const item of valid) {
    if (existing.has(item.sku.toLowerCase())) { const kept = restrict(item, update); if (kept) toUpdate.push(kept); continue; }
    const missing = REQUIRED.filter(([field]) => item.data[field] === undefined).map(([, label]) => label);
    if (missing.length > 0) errors.push({ rowNumber: item.rowNumber, message: `Artículo nuevo: faltan ${missing.join(", ")}` });
    else toCreate.push(item);
  }
  return { toCreate, toUpdate, errors };
}
