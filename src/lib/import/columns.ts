import { normalizeText } from "@/lib/text";

export type ColumnKey = "sku" | "name" | "description" | "category" | "subCategory" | "brand" | "cashPrice" | "listPrice" | "available" | "features" | "outlet" | "active";

const ALIASES: Record<ColumnKey, string[]> = {
  sku: ["sku", "codigo", "cod", "codigo sku"],
  name: ["nombre", "articulo", "producto", "name"],
  description: ["descripcion", "description"],
  category: ["categoria", "rubro", "category"],
  subCategory: ["subcategoria", "subrubro", "sub categoria"],
  brand: ["marca", "brand"],
  cashPrice: ["precio efectivo", "efectivo", "precio_efectivo"],
  listPrice: ["precio contado", "contado", "precio lista", "precio_contado", "precio"],
  available: ["disponible", "disponibilidad"],
  features: ["caracteristicas", "features"],
  outlet: ["outlet"],
  active: ["activo", "active"]
};

const key = (value: string) => normalizeText(value).replace(/_/g, " ");

export const HEADER_ALIASES: Record<string, ColumnKey> = Object.fromEntries(
  (Object.entries(ALIASES) as [ColumnKey, string[]][]).flatMap(([column, names]) => names.map((n) => [key(n), column]))
);

export function columnForHeader(header: string): ColumnKey | undefined {
  return HEADER_ALIASES[key(header)];
}
