import type { ColumnKey } from "./columns";

export type RawRow = { rowNumber: number; cells: Partial<Record<ColumnKey, unknown>> };
export type ProductFields = {
  name: string; description: string; category: string; subCategory: string; brand: string;
  cashPrice: number; listPrice: number; available: boolean; features: string[]; outlet: boolean; active: boolean;
};
export type ImportRow = { rowNumber: number; sku: string; data: Partial<ProductFields> };
export type RowError = { rowNumber: number; message: string };

const isBlank = (v: unknown) => v === undefined || v === null || String(v).trim() === "";

export function parsePrice(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) && value >= 0 ? value : null;
  const text = String(value ?? "").replace(/[$\s]/g, "");
  if (!/^\d+([.,]\d+)*$/.test(text)) return null;
  const [integerPart, decimalPart, ...rest] = text.split(",");
  if (rest.length > 0) return null;
  if (decimalPart === undefined && /^\d+\.\d{1,2}$/.test(integerPart)) return Number(integerPart);
  const grouped = integerPart.includes(".") || (decimalPart === undefined && /\.\d{3}$/.test(integerPart));
  let integer = integerPart;
  if (grouped) {
    if (!/^\d{1,3}(\.\d{3})+$/.test(integerPart)) return null;
    integer = integerPart.replace(/\./g, "");
  }
  const n = Number(decimalPart === undefined ? integer : `${integer}.${decimalPart}`);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function parseBool(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  const t = String(value).trim().toLowerCase();
  if (["si", "sí", "s", "1", "true", "yes", "x"].includes(t)) return true;
  if (["no", "n", "0", "false"].includes(t)) return false;
  return null;
}

const TEXT_FIELDS = ["name", "description", "category", "subCategory", "brand"] as const;
const PRICE_FIELDS = [["cashPrice", "Precio efectivo"], ["listPrice", "Precio contado"]] as const;
const BOOL_FIELDS = [["available", "Disponible"], ["outlet", "Outlet"], ["active", "Activo"]] as const;

export function parseRows(rows: RawRow[]): { valid: ImportRow[]; errors: RowError[] } {
  const valid: ImportRow[] = [];
  const errors: RowError[] = [];
  const seen = new Map<string, number>();
  for (const { rowNumber, cells } of rows) {
    const sku = String(cells.sku ?? "").trim();
    if (!sku) { errors.push({ rowNumber, message: "Falta el SKU" }); continue; }
    const key = sku.toLowerCase();
    if (seen.has(key)) { errors.push({ rowNumber, message: `SKU repetido en el archivo (ya aparece en la fila ${seen.get(key)})` }); continue; }
    const data: Partial<ProductFields> = {};
    let problem = "";
    for (const field of TEXT_FIELDS) if (!isBlank(cells[field])) data[field] = String(cells[field]).trim();
    for (const [field, label] of PRICE_FIELDS) {
      if (isBlank(cells[field])) continue;
      const price = parsePrice(cells[field]);
      if (price === null) { problem = `${label} inválido: "${String(cells[field]).trim()}"`; break; }
      data[field] = price;
    }
    if (!problem) for (const [field, label] of BOOL_FIELDS) {
      if (isBlank(cells[field])) continue;
      const flag = parseBool(cells[field]);
      if (flag === null) { problem = `${label} inválido: "${String(cells[field]).trim()}" (usá sí/no)`; break; }
      data[field] = flag;
    }
    if (!problem && !isBlank(cells.features)) data.features = String(cells.features).split(/[|;]/).map((f) => f.trim()).filter(Boolean).slice(0, 8);
    if (problem) { errors.push({ rowNumber, message: problem }); continue; }
    seen.set(key, rowNumber);
    valid.push({ rowNumber, sku, data });
  }
  return { valid, errors };
}
