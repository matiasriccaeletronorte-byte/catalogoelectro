import { Types } from "mongoose";
import { NextResponse } from "next/server";
import { isAdmin, unauthorized } from "@/lib/admin-auth";
import { processImage } from "@/lib/image-process";
import { getStorage } from "@/lib/storage";
import { detectImageType, MAX_UPLOAD_BYTES } from "@/lib/uploads";

export const maxDuration = 30;

const BANNER_WIDTH = 2000;

/** Sube la imagen de un slide del carrusel al almacenamiento de fotos y devuelve su URL. */
export async function POST(request: Request) {
  if (!(await isAdmin(request))) return unauthorized();
  const file = (await request.formData()).get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Falta el archivo" }, { status: 400 });
  if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: "La imagen supera los 4 MB." }, { status: 400 });
  const bytes = Buffer.from(await file.arrayBuffer());
  if (!detectImageType(bytes)) return NextResponse.json({ error: "Formato no permitido. Usá JPG, PNG o WebP." }, { status: 400 });
  let optimized: Buffer;
  try {
    optimized = await processImage(bytes, BANNER_WIDTH);
  } catch {
    return NextResponse.json({ error: "No se pudo leer la imagen." }, { status: 400 });
  }
  const url = await getStorage().put(`${new Types.ObjectId().toString()}-${Date.now()}.webp`, optimized, "image/webp");
  return NextResponse.json({ url }, { status: 201 });
}
