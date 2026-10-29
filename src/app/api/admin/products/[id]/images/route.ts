import { NextResponse } from "next/server";
import { isAdmin, unauthorized } from "@/lib/admin-auth";
import { connectDb } from "@/lib/db";
import { processImage } from "@/lib/image-process";
import { getStorage } from "@/lib/storage";
import { detectImageType, isObjectId, MAX_IMAGES_PER_PRODUCT, MAX_UPLOAD_BYTES } from "@/lib/uploads";
import { ProductModel } from "@/models/Product";

export const maxDuration = 30;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin(request))) return unauthorized();
  const { id } = await params;
  if (!isObjectId(id)) return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
  const file = (await request.formData()).get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Falta el archivo" }, { status: 400 });
  if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: "La imagen supera los 4 MB." }, { status: 400 });
  const bytes = Buffer.from(await file.arrayBuffer());
  if (!detectImageType(bytes)) return NextResponse.json({ error: "Formato no permitido. Usá JPG, PNG o WebP." }, { status: 400 });
  let optimized: Buffer;
  try {
    optimized = await processImage(bytes);
  } catch {
    return NextResponse.json({ error: "No se pudo leer la imagen." }, { status: 400 });
  }
  await connectDb();
  const product = await ProductModel.findById(id);
  if (!product) return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
  if ((product.images ?? []).length >= MAX_IMAGES_PER_PRODUCT) return NextResponse.json({ error: `Máximo ${MAX_IMAGES_PER_PRODUCT} imágenes por artículo.` }, { status: 400 });
  const storage = getStorage();
  const url = await storage.put(`${id}-${Date.now()}.webp`, optimized, "image/webp");
  product.images = [...(product.images ?? []), url];
  product.image = product.images[0];
  try {
    await product.save();
  } catch (error) {
    await storage.remove(url);
    throw error;
  }
  return NextResponse.json({ url, images: product.images }, { status: 201 });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin(request))) return unauthorized();
  const { id } = await params;
  if (!isObjectId(id)) return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
  const url = new URL(request.url).searchParams.get("url") ?? "";
  await connectDb();
  const product = await ProductModel.findById(id);
  if (!product) return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
  if (!(product.images ?? []).includes(url)) return NextResponse.json({ images: product.images });
  product.images = (product.images ?? []).filter((item: string) => item !== url);
  product.image = product.images[0] ?? "";
  await product.save();
  await getStorage().remove(url);
  return NextResponse.json({ images: product.images });
}
