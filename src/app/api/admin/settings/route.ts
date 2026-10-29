import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin, unauthorized } from "@/lib/admin-auth";
import { connectDb } from "@/lib/db";
import { getSiteSettings } from "@/lib/site-settings";
import { SiteSettingsModel } from "@/models/SiteSettings";

const branchSchema = z.object({
  name: z.string().trim().min(1).max(80),
  city: z.string().trim().max(80),
  phone: z.string().trim().max(30),
  whatsapp: z.string().trim().max(30),
  query: z.string().trim().max(160)
});

const schema = z.object({
  whatsappPhone: z.string().trim().max(30),
  whatsappTemplate: z.string().trim().max(500),
  bbvaDates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).max(60),
  branches: z.array(branchSchema).max(6)
});

export async function GET(request: Request) {
  if (!(await isAdmin(request))) return unauthorized();
  return NextResponse.json(await getSiteSettings());
}

export async function PUT(request: Request) {
  if (!(await isAdmin(request))) return unauthorized();
  const data = schema.safeParse(await request.json());
  if (!data.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  await connectDb();
  await SiteSettingsModel.updateOne({ key: "main" }, { $set: { ...data.data, bbvaDates: [...new Set(data.data.bbvaDates)].sort() } }, { upsert: true });
  return NextResponse.json(await getSiteSettings());
}
