import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin, unauthorized } from "@/lib/admin-auth";
import { connectDb } from "@/lib/db";
import { CategoryModel } from "@/models/Category";
import { SiteSettingsModel } from "@/models/SiteSettings";
import { ProductModel } from "@/models/Product";
import { renameInProducts } from "@/lib/taxonomy";

export async function GET(request: Request) {
  if (!(await isAdmin(request))) return unauthorized();
  await connectDb();
  const [saved, used] = await Promise.all([CategoryModel.find().sort({ name: 1 }).lean(), ProductModel.distinct("category")]);
  const names = [...new Set([...saved.map(category => category.name), ...used])].sort();
  return NextResponse.json(names);
}

export async function POST(request: Request) {
  if (!(await isAdmin(request))) return unauthorized();
  const data = z.object({ name: z.string().min(2).max(40) }).safeParse(await request.json());
  if (!data.success) return NextResponse.json({ error: "Categoría inválida" }, { status: 400 });
  await connectDb();
  await CategoryModel.updateOne({ name: data.data.name }, { $setOnInsert: data.data }, { upsert: true });
  return NextResponse.json(data.data, { status: 201 });
}

const nameSchema = z.string().trim().min(2).max(40);

/** Renombra una categoría. Si el nombre nuevo ya existe, las dos se unen. */
export async function PATCH(request: Request) {
  if (!(await isAdmin(request))) return unauthorized();
  const data = z.object({ name: nameSchema, newName: nameSchema }).safeParse(await request.json());
  if (!data.success) return NextResponse.json({ error: "Nombre inválido" }, { status: 400 });
  const { name, newName } = data.data;
  if (name === newName) return NextResponse.json({ ok: true });
  await connectDb();
  const old = (await CategoryModel.findOne({ name }).lean()) as { subCategories?: string[] } | null;
  await CategoryModel.updateOne({ name: newName }, { $setOnInsert: { name: newName }, $addToSet: { subCategories: { $each: old?.subCategories ?? [] } } }, { upsert: true });
  await CategoryModel.deleteOne({ name });
  await renameInProducts("category", name, newName);
  const settings = await SiteSettingsModel.findOne();
  if (settings?.categoryImages?.some((item: { name: string }) => item.name === name)) {
    const kept = settings.categoryImages.filter((item: { name: string }) => item.name !== newName);
    settings.categoryImages = kept.map((item: { name: string; image: string }) => (item.name === name ? { name: newName, image: item.image } : item));
    await settings.save();
  }
  return NextResponse.json({ ok: true });
}

/** Elimina una categoría, solo si ningún artículo la usa. */
export async function DELETE(request: Request) {
  if (!(await isAdmin(request))) return unauthorized();
  const data = z.object({ name: nameSchema }).safeParse(await request.json());
  if (!data.success) return NextResponse.json({ error: "Nombre inválido" }, { status: 400 });
  await connectDb();
  const count = await ProductModel.countDocuments({ category: data.data.name });
  if (count > 0) return NextResponse.json({ error: `Hay ${count} artículos en esa categoría. Pasalos a otra (o renombrala) antes de eliminarla.` }, { status: 409 });
  await CategoryModel.deleteOne({ name: data.data.name });
  await SiteSettingsModel.updateOne({}, { $pull: { categoryImages: { name: data.data.name } } });
  return NextResponse.json({ ok: true });
}
