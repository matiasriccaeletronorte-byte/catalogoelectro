import { NextResponse } from "next/server";
import { isAdmin, unauthorized } from "@/lib/admin-auth";
import { buildMatch, parseFilters } from "@/lib/catalog-filters";
import { toPublicProduct } from "@/lib/catalog-query";
import { connectDb } from "@/lib/db";
import { productInputSchema, withSearchText } from "@/lib/product-schema";
import { ProductModel } from "@/models/Product";

const ADMIN_PAGE_SIZE = 25;

export async function GET(request: Request) {
  if (!(await isAdmin(request))) return unauthorized();
  await connectDb();
  const { searchParams } = new URL(request.url);
  const filters = parseFilters(searchParams);
  const match = buildMatch({ ...filters, category: "", subCategory: "", brands: [], minPrice: undefined, maxPrice: undefined, availableOnly: false });
  const limit = Math.min(30, Math.max(1, Number(searchParams.get("limit")) || ADMIN_PAGE_SIZE));
  const [rows, total] = await Promise.all([
    ProductModel.find(match).sort({ createdAt: -1, _id: 1 }).skip((filters.page - 1) * limit).limit(limit).lean(),
    ProductModel.countDocuments(match)
  ]);
  return NextResponse.json({ items: rows.map((r) => toPublicProduct(r as unknown as Record<string, unknown>)), total, page: filters.page, pageSize: limit });
}

export async function POST(request: Request) {
  if (!(await isAdmin(request))) return unauthorized();
  const data = productInputSchema.safeParse(await request.json());
  if (!data.success) return NextResponse.json({ error: data.error.issues[0]?.message ?? "Datos de producto inválidos" }, { status: 400 });
  await connectDb();
  try {
    const product = await ProductModel.create(withSearchText(data.data));
    return NextResponse.json({ id: String(product._id) }, { status: 201 });
  } catch (error) {
    if ((error as { code?: number }).code === 11000) return NextResponse.json({ error: "Ya existe un artículo con ese SKU" }, { status: 409 });
    throw error;
  }
}
