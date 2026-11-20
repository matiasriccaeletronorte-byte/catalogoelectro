import { Types } from "mongoose";
import type { CatalogFilters } from "@/lib/catalog-filters";
import { MAX_QUERY_LENGTH, MAX_WORDS } from "@/lib/catalog-filters";
import { normalizeText } from "@/lib/text";

// Arma los filtros de MongoDB. Solo se usa en el servidor: acá vive la dependencia de mongoose, que no debe llegar al navegador.
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function buildMatch(f: CatalogFilters, omit?: "category" | "subCategory" | "brand" | "price"): Record<string, unknown> {
  const match: Record<string, unknown> = { active: { $ne: false } };
  if (f.availableOnly) match.available = true;
  if (f.outletOnly) match.outlet = true;
  if (omit !== "category" && omit !== "subCategory" && f.category) match.category = f.category;
  if (omit !== "category" && omit !== "subCategory" && f.subCategory) match.subCategory = f.subCategory;
  if (omit !== "category" && omit !== "subCategory" && f.categoryId) match.categoryPath = new Types.ObjectId(f.categoryId);
  if (omit === "subCategory" && f.category) match.category = f.category;
  if (omit !== "brand" && f.brands.length > 0) match.brand = { $in: f.brands };
  if (omit !== "price" && (f.minPrice !== undefined || f.maxPrice !== undefined)) {
    const range: Record<string, number> = {};
    if (f.minPrice !== undefined) range.$gte = f.minPrice;
    if (f.maxPrice !== undefined) range.$lte = f.maxPrice;
    match.listPrice = range;
  }
  const andWords = searchClauses(f.q);
  if (andWords.length > 0) match.$and = andWords;
  return match;
}

function searchClauses(q: string) {
  return normalizeText(q).split(" ").filter(Boolean).slice(0, MAX_WORDS).map((w) => ({ searchText: { $regex: escapeRegex(w) } }));
}

/** Filtro del listado del admin: incluye artículos desactivados para poder reactivarlos. */
export function buildAdminMatch(q: string): Record<string, unknown> {
  const clauses = searchClauses(q.trim().slice(0, MAX_QUERY_LENGTH));
  return clauses.length > 0 ? { $and: clauses } : {};
}
