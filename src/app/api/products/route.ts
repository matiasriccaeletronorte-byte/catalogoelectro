import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { initialProducts } from "@/lib/seed";
import { ProductModel } from "@/models/Product";

const MAX_PAGE_SIZE = 48;

export async function GET(request: Request) {
  await connectDb();
  if (await ProductModel.countDocuments() === 0) await ProductModel.insertMany(initialProducts);

  const { searchParams } = new URL(request.url);
  const ids = (searchParams.get("ids") ?? "").split(",").map((id) => id.trim()).filter(Boolean).slice(0, 12);
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(searchParams.get("pageSize") ?? "24") || 24));
  const category = searchParams.get("category")?.trim() ?? "";
  const query = searchParams.get("q")?.trim() ?? "";
  const baseFilter: Record<string, unknown> = { active: { $ne: false }, stock: { $gt: 0 } };

  if (ids.length > 0) baseFilter._id = { $in: ids };
  else {
    if (category && category !== "Todos") baseFilter.category = category;
    if (query) baseFilter.$text = { $search: query };
  }

  const [rows, total, categories] = await Promise.all([
    ProductModel.find(baseFilter).sort(ids.length > 0 ? { createdAt: -1 } : query ? { score: { $meta: "textScore" } } : { createdAt: -1 }).skip(ids.length > 0 ? 0 : (page - 1) * pageSize).limit(ids.length > 0 ? ids.length : pageSize).lean(),
    ids.length > 0 ? Promise.resolve(ids.length) : ProductModel.countDocuments(baseFilter),
    ProductModel.distinct("category", { active: { $ne: false }, stock: { $gt: 0 } })
  ]);
  const byId = new Map(rows.map((row) => [String(row._id), row]));
  const products = (ids.length > 0 ? ids.map((id) => byId.get(id)).filter(Boolean) : rows).map((row) => {
    const { _id, ...product } = row!;
    return { ...product, id: String(_id) };
  });
  const response = NextResponse.json({ items: products, total, page, pageSize, categories: categories.sort() });
  response.headers.set("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
  return response;
}
