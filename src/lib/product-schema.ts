import { z } from "zod";
import { normalizeText } from "@/lib/text";

export const productInputSchema = z.object({
  sku: z.string().trim().min(1, "Falta el SKU"),
  name: z.string().trim().min(2),
  description: z.string().default(""),
  cashPrice: z.coerce.number().min(0),
  listPrice: z.coerce.number().min(0),
  available: z.boolean().default(true),
  category: z.string().trim().min(2),
  subCategory: z.string().trim().default(""),
  brand: z.string().trim().default(""),
  features: z.array(z.string().trim().min(1).max(50)).max(8).default([]),
  outlet: z.boolean().default(false),
  active: z.boolean().default(true)
});

export type ProductInput = z.infer<typeof productInputSchema>;

type Searchable = { sku?: string; name?: string; brand?: string; category?: string; subCategory?: string };

export function searchTextOf(doc: Searchable): string {
  return normalizeText([doc.sku, doc.name, doc.brand, doc.category, doc.subCategory].filter(Boolean).join(" "));
}

export function withSearchText<T extends Searchable>(doc: T): T & { searchText: string } {
  return { ...doc, searchText: searchTextOf(doc) };
}
