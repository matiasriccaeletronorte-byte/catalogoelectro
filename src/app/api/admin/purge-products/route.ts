import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin, unauthorized } from "@/lib/admin-auth";
import { connectDb } from "@/lib/db";
import { ProductModel } from "@/models/Product";

const CONFIRM_WORD = "BORRAR";

/** Cuántos artículos hay (para mostrarlo antes de borrar). */
export async function GET(request: Request) {
  if (!(await isAdmin(request))) return unauthorized();
  await connectDb();
  return NextResponse.json({ total: await ProductModel.countDocuments() });
}

/** Borra TODOS los artículos. Solo con sesión de admin y la palabra de confirmación exacta. No toca categorías, marcas, cupones ni ajustes. */
export async function POST(request: Request) {
  if (!(await isAdmin(request))) return unauthorized();
  const data = z.object({ confirm: z.literal(CONFIRM_WORD) }).safeParse(await request.json().catch(() => ({})));
  if (!data.success) return NextResponse.json({ error: `Para borrar escribí ${CONFIRM_WORD}.` }, { status: 400 });
  await connectDb();
  const result = await ProductModel.deleteMany({});
  return NextResponse.json({ deleted: result.deletedCount ?? 0 });
}
