import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin, unauthorized } from "@/lib/admin-auth";
import { connectDb } from "@/lib/db";
import { CategoryModel } from "@/models/Category";
import { ProductModel } from "@/models/Product";

/** Subcategorías por categoría: las creadas desde el panel más las que ya usan los artículos. */
export async function GET(request: Request) {
  if (!(await isAdmin(request))) return unauthorized();
  await connectDb();
  const [saved, used] = await Promise.all([
    CategoryModel.find().lean() as unknown as Promise<{ name: string; subCategories?: string[] }[]>,
    ProductModel.aggregate([{ $match: { subCategory: { $nin: ["", null] }, category: { $nin: ["", null] } } }, { $group: { _id: { c: "$category", s: "$subCategory" } } }]) as Promise<{ _id: { c: string; s: string } }[]>
  ]);
  const tree: Record<string, string[]> = {};
  for (const category of saved) tree[category.name] = [...(category.subCategories ?? [])];
  for (const { _id } of used) tree[_id.c] = [...new Set([...(tree[_id.c] ?? []), _id.s])];
  for (const key of Object.keys(tree)) tree[key].sort((a, b) => a.localeCompare(b, "es"));
  return NextResponse.json(tree);
}

const schema = z.object({ category: z.string().trim().min(2).max(40), name: z.string().trim().min(2).max(40) });

export async function POST(request: Request) {
  if (!(await isAdmin(request))) return unauthorized();
  const data = schema.safeParse(await request.json());
  if (!data.success) return NextResponse.json({ error: "Subcategoría inválida" }, { status: 400 });
  await connectDb();
  await CategoryModel.updateOne({ name: data.data.category }, { $addToSet: { subCategories: data.data.name } }, { upsert: true });
  return NextResponse.json(data.data, { status: 201 });
}

export async function DELETE(request: Request) {
  if (!(await isAdmin(request))) return unauthorized();
  const data = schema.safeParse(await request.json());
  if (!data.success) return NextResponse.json({ error: "Subcategoría inválida" }, { status: 400 });
  await connectDb();
  if (await ProductModel.exists({ category: data.data.category, subCategory: data.data.name })) {
    return NextResponse.json({ error: "Hay artículos con esa subcategoría. Cambialos antes de quitarla." }, { status: 409 });
  }
  await CategoryModel.updateOne({ name: data.data.category }, { $pull: { subCategories: data.data.name } });
  return NextResponse.json({ ok: true });
}
