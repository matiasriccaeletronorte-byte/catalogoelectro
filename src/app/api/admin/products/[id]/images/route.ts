import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { isAdmin, unauthorized } from "@/lib/admin-auth";
import { connectDb } from "@/lib/db";
import { extensionFor, isSafeUploadName, MAX_UPLOAD_BYTES, uploadDir } from "@/lib/uploads";
import { ProductModel } from "@/models/Product";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin(request))) return unauthorized();
  const { id } = await params;
  if (!/^[a-f0-9]{24}$/.test(id)) return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
  const file = (await request.formData()).get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Falta el archivo" }, { status: 400 });
  const ext = extensionFor(file.type);
  if (!ext) return NextResponse.json({ error: "Formato no permitido. Usá JPG, PNG o WebP." }, { status: 400 });
  if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: "La imagen supera los 5 MB." }, { status: 400 });
  await connectDb();
  const product = await ProductModel.findById(id);
  if (!product) return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
  const name = `${id}-${Date.now()}.${ext}`;
  await mkdir(uploadDir(), { recursive: true });
  await writeFile(path.join(uploadDir(), name), Buffer.from(await file.arrayBuffer()));
  const url = `/api/uploads/${name}`;
  product.images = [...(product.images ?? []), url];
  product.image = product.images[0];
  await product.save();
  return NextResponse.json({ url, images: product.images }, { status: 201 });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin(request))) return unauthorized();
  const { id } = await params;
  const url = new URL(request.url).searchParams.get("url") ?? "";
  await connectDb();
  const product = await ProductModel.findById(id);
  if (!product) return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
  product.images = (product.images ?? []).filter((item: string) => item !== url);
  product.image = product.images[0] ?? "";
  await product.save();
  const name = url.replace("/api/uploads/", "");
  if (url.startsWith("/api/uploads/") && isSafeUploadName(name)) await unlink(path.join(uploadDir(), name)).catch(() => undefined);
  return NextResponse.json({ images: product.images });
}
