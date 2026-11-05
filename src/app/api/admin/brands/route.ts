import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin, unauthorized } from "@/lib/admin-auth";
import { connectDb } from "@/lib/db";
import { renameInProducts } from "@/lib/taxonomy";
import { BrandModel } from "@/models/Brand";
import { ProductModel } from "@/models/Product";

const nameSchema = z.string().trim().min(1).max(40);

/** Marcas con su cantidad de artículos: las creadas desde el panel más las que ya usan los artículos. */
export async function GET(request: Request) {
  if (!(await isAdmin(request))) return unauthorized();
  await connectDb();
  const [saved, used] = await Promise.all([
    BrandModel.find().lean() as unknown as Promise<{ name: string }[]>,
    ProductModel.aggregate([{ $match: { brand: { $nin: ["", null] } } }, { $group: { _id: "$brand", count: { $sum: 1 } } }]) as Promise<{ _id: string; count: number }[]>
  ]);
  const counts = new Map(used.map((row) => [row._id, row.count]));
  const names = [...new Set([...saved.map((brand) => brand.name), ...counts.keys()])].sort((a, b) => a.localeCompare(b, "es"));
  return NextResponse.json(names.map((name) => ({ name, count: counts.get(name) ?? 0 })));
}

export async function POST(request: Request) {
  if (!(await isAdmin(request))) return unauthorized();
  const data = z.object({ name: nameSchema }).safeParse(await request.json());
  if (!data.success) return NextResponse.json({ error: "Marca inválida" }, { status: 400 });
  await connectDb();
  await BrandModel.updateOne({ name: data.data.name }, { $setOnInsert: data.data }, { upsert: true });
  return NextResponse.json(data.data, { status: 201 });
}

/** Renombra una marca en todos los artículos. Si el nombre nuevo ya existe, se unen. */
export async function PATCH(request: Request) {
  if (!(await isAdmin(request))) return unauthorized();
  const data = z.object({ name: nameSchema, newName: nameSchema }).safeParse(await request.json());
  if (!data.success) return NextResponse.json({ error: "Nombre inválido" }, { status: 400 });
  const { name, newName } = data.data;
  if (name === newName) return NextResponse.json({ ok: true });
  await connectDb();
  await BrandModel.updateOne({ name: newName }, { $setOnInsert: { name: newName } }, { upsert: true });
  await BrandModel.deleteOne({ name });
  await renameInProducts("brand", name, newName);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  if (!(await isAdmin(request))) return unauthorized();
  const data = z.object({ name: nameSchema }).safeParse(await request.json());
  if (!data.success) return NextResponse.json({ error: "Nombre inválido" }, { status: 400 });
  await connectDb();
  const count = await ProductModel.countDocuments({ brand: data.data.name });
  if (count > 0) return NextResponse.json({ error: `Hay ${count} artículos con esa marca. Cambialos (o renombrala) antes de eliminarla.` }, { status: 409 });
  await BrandModel.deleteOne({ name: data.data.name });
  return NextResponse.json({ ok: true });
}
