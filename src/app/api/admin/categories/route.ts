import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin, unauthorized } from "@/lib/admin-auth";
import { connectDb } from "@/lib/db";
import { CategoryModel } from "@/models/Category";
import { ProductModel } from "@/models/Product";

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
