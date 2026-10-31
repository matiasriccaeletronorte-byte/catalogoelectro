import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { parseFilters } from "@/lib/catalog-filters";
import { runCatalogQuery, toPublicProduct } from "@/lib/catalog-query";
import { ProductModel } from "@/models/Product";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ids = (searchParams.get("ids") ?? "").split(",").map((id) => id.trim()).filter(Boolean).slice(0, 40);
  let body: unknown;
  if (ids.length > 0) {
    await connectDb();
    let rows: Record<string, unknown>[] = [];
    try {
      rows = await ProductModel.find({ _id: { $in: ids }, active: { $ne: false } }).lean() as unknown as Record<string, unknown>[];
    } catch {
      rows = [];
    }
    const byId = new Map(rows.map((row) => [String(row._id), row]));
    body = { items: ids.map((id) => byId.get(id)).filter(Boolean).map((row) => toPublicProduct(row!)) };
  } else {
    body = await runCatalogQuery(parseFilters(searchParams));
  }
  const response = NextResponse.json(body);
  response.headers.set("Cache-Control", "public, s-maxage=30, stale-while-revalidate=120");
  return response;
}
