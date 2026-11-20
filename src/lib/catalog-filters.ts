import { normalizeText } from "@/lib/text";

export type SortKey = "relevance" | "price_asc" | "price_desc" | "newest";
export type CatalogFilters = {
  q: string; category: string; subCategory: string; categoryId: string; brands: string[];
  minPrice?: number; maxPrice?: number; availableOnly: boolean; outletOnly: boolean; sort: SortKey; page: number;
};

export const PAGE_SIZE = 24;
export const MAX_PAGE = 1000;
export const MAX_QUERY_LENGTH = 100;
export const MAX_WORDS = 8;
const MAX_BRANDS = 20;
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
    q: (params.get("q") ?? "").trim().slice(0, MAX_QUERY_LENGTH),
    category: (params.get("category") ?? "").trim(),
    subCategory: (params.get("subCategory") ?? "").trim(),
    categoryId: /^[a-f0-9]{24}$/.test(params.get("cat") ?? "") ? (params.get("cat") as string) : "",
    brands: params.getAll("brand").map((b) => b.trim()).filter(Boolean).slice(0, MAX_BRANDS),
    minPrice: positiveNumber(params.get("minPrice")),
    maxPrice: positiveNumber(params.get("maxPrice")),
    availableOnly: params.get("available") === "1",
    outletOnly: params.get("outlet") === "1",
    sort: SORTS.includes(sort) ? sort : "relevance",
    page: Number.isFinite(page) && page >= 1 ? Math.min(page, MAX_PAGE) : 1
  };
}

export function serializeFilters(f: CatalogFilters): URLSearchParams {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.category) p.set("category", f.category);
  if (f.subCategory) p.set("subCategory", f.subCategory);
  if (f.categoryId) p.set("cat", f.categoryId);
  f.brands.forEach((b) => p.append("brand", b));
  if (f.minPrice !== undefined) p.set("minPrice", String(f.minPrice));
  if (f.maxPrice !== undefined) p.set("maxPrice", String(f.maxPrice));
  if (f.availableOnly) p.set("available", "1");
  if (f.outletOnly) p.set("outlet", "1");
  if (f.sort !== "relevance") p.set("sort", f.sort);
  if (f.page > 1) p.set("page", String(f.page));
  return p;
}
