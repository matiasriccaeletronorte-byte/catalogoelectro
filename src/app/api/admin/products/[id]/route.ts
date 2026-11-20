import { NextResponse } from "next/server";
import { isAdmin, unauthorized } from "@/lib/admin-auth";
import { categoryFieldsFor } from "@/lib/category-store";
import { connectDb } from "@/lib/db";
import { isObjectId } from "@/lib/uploads";
import { productInputSchema, withSearchText } from "@/lib/product-schema";
import { ProductModel } from "@/models/Product";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin(request))) return unauthorized();
  const data = productInputSchema.safeParse(await request.json());
  if (!data.success) return NextResponse.json({ error: data.error.issues[0]?.message ?? "Datos de producto inválidos" }, { status: 400 });
  await connectDb();
  const { id } = await params;
  if (!isObjectId(id)) return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
  const { categoryId, ...rest } = data.data;
  const fields = await categoryFieldsFor(categoryId);
  if (!fields) return NextResponse.json({ error: "La categoría elegida no existe." }, { status: 400 });
  try {
    const product = await ProductModel.findByIdAndUpdate(id, withSearchText({ ...rest, ...fields }), { new: true });
    if (!product) return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
  } catch (error) {
    if ((error as { code?: number }).code === 11000) return NextResponse.json({ error: "Ya existe un artículo con ese SKU" }, { status: 409 });
    throw error;
  }
  return NextResponse.json({ id });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin(request))) return unauthorized();
  await connectDb();
  const { id } = await params;
  if (!isObjectId(id)) return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
  const product = await ProductModel.findByIdAndUpdate(id, { active: false });
  if (!product) return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
  return new Response(null, { status: 204 });
}
