import { connectDb } from "@/lib/db";
import { buildMatch, CatalogFilters, PAGE_SIZE } from "@/lib/catalog-filters";
import { Product } from "@/lib/types";
import { ProductModel } from "@/models/Product";
import type { PipelineStage } from "mongoose";

export type FacetCount = { value: string; count: number };
export type CatalogResult = {
  items: Product[]; total: number; page: number; pageSize: number;
  facets: { categories: FacetCount[]; subCategories: FacetCount[]; brands: FacetCount[]; price: { min: number; max: number } };
};

const SORTS: Record<string, Record<string, 1 | -1>> = {
  relevance: { name: 1 },
  newest: { createdAt: -1 },
  price_asc: { listPrice: 1 },
  price_desc: { listPrice: -1 }
};

const countBy = (field: string): PipelineStage.FacetPipelineStage[] => [{ $match: { [field]: { $nin: ["", null] } } }, { $group: { _id: `$${field}`, count: { $sum: 1 } } }, { $sort: { count: -1 as const, _id: 1 as const } }, { $limit: 100 }];
const toCounts = (rows: { _id: string; count: number }[]): FacetCount[] => rows.map((r) => ({ value: r._id, count: r.count }));

export function toPublicProduct(row: Record<string, unknown>): Product {
  const { _id, searchText, stock, active, createdAt, updatedAt, __v, ...rest } = row;
  return { ...(rest as Omit<Product, "id">), id: String(_id) };
}

export async function runCatalogQuery(f: CatalogFilters): Promise<CatalogResult> {
  await connectDb();
  const sort: Record<string, 1 | -1> = f.q && f.sort === "relevance" ? { name: 1 } : SORTS[f.sort];
  const [rows, [facets]] = await Promise.all([
    ProductModel.find(buildMatch(f)).sort({ ...sort, _id: 1 }).skip((f.page - 1) * PAGE_SIZE).limit(PAGE_SIZE).lean(),
    ProductModel.aggregate([{
      $facet: {
        total: [{ $match: buildMatch(f) }, { $count: "n" }],
        categories: [{ $match: buildMatch(f, "category") }, ...countBy("category")],
        subCategories: [{ $match: buildMatch(f) }, ...countBy("subCategory")],
        brands: [{ $match: buildMatch(f, "brand") }, ...countBy("brand")],
        price: [{ $match: buildMatch(f, "price") }, { $group: { _id: null, min: { $min: "$listPrice" }, max: { $max: "$listPrice" } } }]
      }
    }])
  ]);
  return {
    items: rows.map((row) => toPublicProduct(row as unknown as Record<string, unknown>)),
    total: facets.total[0]?.n ?? 0,
    page: f.page,
    pageSize: PAGE_SIZE,
    facets: {
      categories: toCounts(facets.categories),
      subCategories: f.category ? toCounts(facets.subCategories) : [],
      brands: toCounts(facets.brands),
      price: { min: facets.price[0]?.min ?? 0, max: facets.price[0]?.max ?? 0 }
    }
  };
}
