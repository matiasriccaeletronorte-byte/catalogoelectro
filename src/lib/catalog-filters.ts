import { normalizeText } from "@/lib/text";

export type SortKey = "relevance" | "price_asc" | "price_desc" | "newest";
export type CatalogFilters = {
  q: string; category: string; subCategory: string; brands: string[];
  minPrice?: number; maxPrice?: number; availableOnly: boolean; sort: SortKey; page: number;
};

export const PAGE_SIZE = 24;
const SORTS: SortKey[] = ["relevance", "price_asc", "price_desc", "newest"];

function positiveNumber(value: string | null): number | undefined {
  if (value === null || value.trim() === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

export function parseFilters(params: URLSearchParams): CatalogFilters {
  const sort = params.get("sort") as SortKey;
  const page = Math.floor(Number(params.get("page") ?? "1"));
  return {
    q: (params.get("q") ?? "").trim(),
    category: (params.get("category") ?? "").trim(),
    subCategory: (params.get("subCategory") ?? "").trim(),
    brands: params.getAll("brand").map((b) => b.trim()).filter(Boolean),
    minPrice: positiveNumber(params.get("minPrice")),
    maxPrice: positiveNumber(params.get("maxPrice")),
    availableOnly: params.get("available") === "1",
    sort: SORTS.includes(sort) ? sort : "relevance",
    page: Number.isFinite(page) && page >= 1 ? page : 1
  };
}

export function serializeFilters(f: CatalogFilters): URLSearchParams {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.category) p.set("category", f.category);
  if (f.subCategory) p.set("subCategory", f.subCategory);
  f.brands.forEach((b) => p.append("brand", b));
  if (f.minPrice !== undefined) p.set("minPrice", String(f.minPrice));
  if (f.maxPrice !== undefined) p.set("maxPrice", String(f.maxPrice));
  if (f.availableOnly) p.set("available", "1");
  if (f.sort !== "relevance") p.set("sort", f.sort);
  if (f.page > 1) p.set("page", String(f.page));
  return p;
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function buildMatch(f: CatalogFilters, omit?: "category" | "brand" | "price"): Record<string, unknown> {
  const match: Record<string, unknown> = { active: { $ne: false } };
  if (f.availableOnly) match.available = true;
  if (omit !== "category") {
    if (f.category) match.category = f.category;
    if (f.subCategory) match.subCategory = f.subCategory;
  }
  if (omit !== "brand" && f.brands.length > 0) match.brand = { $in: f.brands };
  if (omit !== "price" && (f.minPrice !== undefined || f.maxPrice !== undefined)) {
    const range: Record<string, number> = {};
    if (f.minPrice !== undefined) range.$gte = f.minPrice;
    if (f.maxPrice !== undefined) range.$lte = f.maxPrice;
    match.listPrice = range;
  }
  const words = normalizeText(f.q).split(" ").filter(Boolean);
  if (words.length > 0) match.$and = words.map((w) => ({ searchText: { $regex: escapeRegex(w) } }));
  return match;
}
