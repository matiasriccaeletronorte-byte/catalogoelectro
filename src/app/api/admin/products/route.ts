import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin, unauthorized } from "@/lib/admin-auth";
import { connectDb } from "@/lib/db";
import { ProductModel } from "@/models/Product";
import { normalizeImageUrl } from "@/lib/image-url";

const schema = z.object({
  sku: z.string().trim().min(1).optional().or(z.literal("")),
  name: z.string().min(2),
  description: z.string().min(2),
  price: z.coerce.number().min(0),
  stock: z.coerce.number().int().min(0),
  category: z.string().min(2),
  subCategory: z.string().trim().optional().or(z.literal("")).default(""),
  brand: z.string().trim().optional().or(z.literal("")).default(""),
  features: z.array(z.string().trim().min(1).max(50)).max(8).default([]),
  outlet: z.boolean().default(false),
  image: z.string().default(""),
  images: z.array(z.string().trim().min(1)).default([])
});

function normalizeImages(images: string[], image: string) {
  const cleaned = images.map((item) => item.trim()).filter(Boolean);
  if (cleaned.length > 0) return cleaned;
  const fallback = image.trim();
  return fallback ? [fallback] : [];
}

export async function GET(request: Request) {
  if (!(await isAdmin(request))) return unauthorized();
  await connectDb();
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";
  const requestedLimit = Number(searchParams.get("limit") ?? "0");
  const limit = Number.isFinite(requestedLimit) && requestedLimit > 0 ? Math.min(Math.floor(requestedLimit), 30) : 0;
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const filter = query
    ? { active: { $ne: false }, $or: [{ name: { $regex: escapedQuery, $options: "i" } }, { sku: { $regex: escapedQuery, $options: "i" } }, { brand: { $regex: escapedQuery, $options: "i" } }] }
    : { active: { $ne: false } };
  const productQuery = ProductModel.find(filter).sort({ createdAt: -1 });
  if (limit) productQuery.limit(limit);
  const products = await productQuery.lean();
  return NextResponse.json(products.map(({ _id, ...product }) => ({ ...product, id: String(_id) })));
}

export async function POST(request: Request) {
  if (!(await isAdmin(request))) return unauthorized();
  const data = schema.safeParse(await request.json());
  if (!data.success) return NextResponse.json({ error: "Datos de producto inválidos" }, { status: 400 });
  await connectDb();
  const payload = {
    ...data.data,
    sku: data.data.sku?.trim() || undefined,
    image: normalizeImageUrl(data.data.image),
    images: normalizeImages(data.data.images.map((image) => normalizeImageUrl(image)), normalizeImageUrl(data.data.image))
  };
  const product = await ProductModel.create(payload);
  return NextResponse.json({ ...payload, id: String(product._id) }, { status: 201 });
}
