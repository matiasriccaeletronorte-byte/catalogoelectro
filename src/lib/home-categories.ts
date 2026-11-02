import { ProductModel } from "@/models/Product";

export type CategoryTile = { name: string; image: string; total: number };

/** Categorías para el selector rápido de la home: la foto cargada en el admin o, si no hay, la de un artículo de esa categoría. */
export async function buildCategoryTiles(uploaded: { name: string; image: string }[], limit = 30): Promise<CategoryTile[]> {
  const active = { active: { $ne: false }, category: { $nin: ["", null] } };
  const [counts, photos] = await Promise.all([
    ProductModel.aggregate([
      { $match: active },
      { $group: { _id: "$category", total: { $sum: 1 } } },
      { $sort: { total: -1, _id: 1 } },
      { $limit: limit }
    ]) as Promise<{ _id: string; total: number }[]>,
    ProductModel.aggregate([
      { $match: { ...active, image: { $nin: ["", null] } } },
      { $sort: { createdAt: -1, _id: 1 } },
      { $group: { _id: "$category", image: { $first: "$image" } } }
    ]) as Promise<{ _id: string; image: string }[]>
  ]);
  const custom = new Map(uploaded.map((item) => [item.name, item.image]));
  const fromProducts = new Map(photos.map((row) => [row._id, row.image]));
  return counts.map((row) => ({ name: row._id, total: row.total, image: custom.get(row._id) || fromProducts.get(row._id) || "" }));
}
