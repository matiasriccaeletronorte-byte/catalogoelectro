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
  outlet: z.boolean(),
  image: z.string().default(""),
  images: z.array(z.string().trim().min(1)).default([])
});

function normalizeImages(images: string[], image: string) {
  const cleaned = images.map((item) => item.trim()).filter(Boolean);
  if (cleaned.length > 0) return cleaned;
  const fallback = image.trim();
  return fallback ? [fallback] : [];
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin(request))) return unauthorized();
  const data = schema.safeParse(await request.json());
  if (!data.success) return NextResponse.json({ error: "Datos de producto inválidos" }, { status: 400 });
  await connectDb();
  const { id } = await params;
  const payload = {
    ...data.data,
    sku: data.data.sku?.trim() || undefined,
    image: normalizeImageUrl(data.data.image),
    images: normalizeImages(data.data.images.map((image) => normalizeImageUrl(image)), normalizeImageUrl(data.data.image))
  };
  const product = await ProductModel.findByIdAndUpdate(id, payload, { new: true });
  if (!product) return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
  return NextResponse.json({ ...payload, id });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin(request))) return unauthorized();
  await connectDb();
  const { id } = await params;
  await ProductModel.findByIdAndUpdate(id, { active: false });
  return new Response(null, { status: 204 });
}
