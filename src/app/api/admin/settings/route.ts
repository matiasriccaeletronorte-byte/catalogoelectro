import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin, unauthorized } from "@/lib/admin-auth";
import { mergeBranchNumbers } from "@/lib/branches";
import { connectDb } from "@/lib/db";
import { getSiteSettings } from "@/lib/site-settings";
import { SiteSettingsModel } from "@/models/SiteSettings";

// de cada sucursal solo se leen el nombre (para emparejarla) y los dos números; lo demás se ignora
const branchSchema = z.object({
  name: z.string().trim().min(1).max(80),
  phone: z.string().trim().max(30).optional(),
  whatsapp: z.string().trim().max(30).optional()
});

const schema = z.object({
  whatsappPhone: z.string().trim().max(30).optional(),
  whatsappTemplate: z.string().trim().max(500),
  bbvaDates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).max(60),
  branches: z.array(branchSchema).max(6),
  categoryImages: z.array(z.object({ name: z.string().trim().min(1).max(80), image: z.string().max(300).regex(/^(https:\/\/\S+|\/api\/uploads\/\S+)$/) })).max(200).default([])
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
  const current = await getSiteSettings();
  const { whatsappPhone, branches, ...rest } = data.data;
  await SiteSettingsModel.updateOne({ key: "main" }, {
    $set: { ...rest, ...(whatsappPhone !== undefined ? { whatsappPhone } : {}), branches: mergeBranchNumbers(current.branches, branches), bbvaDates: [...new Set(data.data.bbvaDates)].sort() }
  }, { upsert: true });
  return NextResponse.json(await getSiteSettings());
}
