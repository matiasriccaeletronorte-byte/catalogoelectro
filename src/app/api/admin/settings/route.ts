import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin, unauthorized } from "@/lib/admin-auth";
import { mergeBranchNumbers } from "@/lib/branches";
import { connectDb } from "@/lib/db";
import { getSiteSettings } from "@/lib/site-settings";
import { SiteSettingsModel } from "@/models/SiteSettings";

// de cada sucursal solo se leen el nombre (para emparejarla) y el WhatsApp; lo demás se ignora
const branchSchema = z.object({
  name: z.string().trim().min(1).max(80),
  whatsapp: z.string().trim().max(30).optional()
});

// cada pantalla del admin guarda solo lo suyo: lo que no se envía no se toca
const schema = z.object({
  whatsappTemplate: z.string().trim().max(500).optional(),
  bbvaDates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).max(60).optional(),
  branches: z.array(branchSchema).max(6).optional(),
  categoryImages: z.array(z.object({ name: z.string().trim().min(1).max(80), image: z.string().max(300).regex(/^(https:\/\/\S+|\/api\/uploads\/\S+)$/) })).max(200).optional()
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
  const { branches, bbvaDates, ...rest } = data.data;
  const set: Record<string, unknown> = { ...rest };
  if (bbvaDates) set.bbvaDates = [...new Set(bbvaDates)].sort();
  if (branches) set.branches = mergeBranchNumbers((await getSiteSettings()).branches, branches);
  await SiteSettingsModel.updateOne({ key: "main" }, { $set: set }, { upsert: true });
  return NextResponse.json(await getSiteSettings());
}
