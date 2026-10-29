import { NextResponse } from "next/server";
import { isAdmin, unauthorized } from "@/lib/admin-auth";
import { connectDb } from "@/lib/db";
import { productInputSchema, withSearchText } from "@/lib/product-schema";
import { ProductModel } from "@/models/Product";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin(request))) return unauthorized();
  const data = productInputSchema.safeParse(await request.json());
  if (!data.success) return NextResponse.json({ error: data.error.issues[0]?.message ?? "Datos de producto inválidos" }, { status: 400 });
  await connectDb();
  const { id } = await params;
  try {
    const product = await ProductModel.findByIdAndUpdate(id, withSearchText(data.data), { new: true });
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
  await ProductModel.findByIdAndUpdate(id, { active: false });
  return new Response(null, { status: 204 });
}
