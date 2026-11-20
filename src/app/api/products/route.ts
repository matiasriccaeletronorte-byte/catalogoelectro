import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { parseFilters } from "@/lib/catalog-filters";
import { getProductsByIds, runCatalogQuery } from "@/lib/catalog-query";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ids = (searchParams.get("ids") ?? "").split(",").map((id) => id.trim()).filter(Boolean).slice(0, 40);
  let body: unknown;
  if (ids.length > 0) {
    await connectDb();
    body = { items: await getProductsByIds(ids) };
  } else {
    body = await runCatalogQuery(parseFilters(searchParams));
  }
  const response = NextResponse.json(body);
  response.headers.set("Cache-Control", "public, s-maxage=30, stale-while-revalidate=120");
  return response;
}
