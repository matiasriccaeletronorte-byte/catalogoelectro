import { toPublicProduct } from "@/lib/catalog-query";
import type { Product } from "@/lib/types";
import { ProductModel } from "@/models/Product";

export type CategoryShelf = { name: string; total: number; items: Product[] };
export type HomeShelves = { outlet: Product[]; categories: CategoryShelf[] };

const asProducts = (rows: unknown[]) => rows.map((row) => toPublicProduct(row as Record<string, unknown>));
const NEWEST_FIRST = { createdAt: -1, _id: 1 } as const;

/** Filas de la home: los outlet y las categorías con más productos, cada una con sus artículos más nuevos. */
export async function buildHomeShelves({ categoryCount = 6, perShelf = 10 } = {}): Promise<HomeShelves> {
  const active = { active: { $ne: false } };
  const [outletRows, topCategories] = await Promise.all([
    ProductModel.find({ ...active, outlet: true }).sort(NEWEST_FIRST).limit(perShelf).lean(),
    ProductModel.aggregate([
      { $match: { ...active, category: { $nin: ["", null] } } },
      { $group: { _id: "$category", total: { $sum: 1 } } },
      { $sort: { total: -1, _id: 1 } },
      { $limit: categoryCount }
    ])
  ]);
  const categories = await Promise.all(
    topCategories.map(async (c: { _id: string; total: number }) => ({
      name: c._id,
      total: c.total,
      items: asProducts(await ProductModel.find({ ...active, category: c._id }).sort(NEWEST_FIRST).limit(perShelf).lean())
    }))
  );
  return { outlet: asProducts(outletRows), categories };
}
