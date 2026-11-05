import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin, unauthorized } from "@/lib/admin-auth";
import { connectDb } from "@/lib/db";
import { MAX_PERCENT, normalizeCode } from "@/lib/coupons";
import { CouponModel } from "@/models/Coupon";

const couponSchema = z.object({
  code: z.string().transform(normalizeCode).pipe(z.string().min(3, "El código necesita al menos 3 letras o números.")),
  type: z.enum(["percent", "fixed"]),
  value: z.coerce.number().positive("El valor tiene que ser mayor a 0.").max(100_000_000),
  minTotal: z.coerce.number().min(0).max(100_000_000).default(0),
  endsAt: z.string().nullable().optional().transform((value) => (value ? new Date(`${value}T23:59:59`) : null)).refine((date) => date === null || !Number.isNaN(date.getTime()), "Fecha inválida."),
  note: z.string().trim().max(120).default(""),
  active: z.boolean().default(true)
}).refine((coupon) => coupon.type !== "percent" || coupon.value <= MAX_PERCENT, { message: `El porcentaje máximo es ${MAX_PERCENT}%.`, path: ["value"] });

const failure = (error: z.ZodError) => NextResponse.json({ error: error.issues[0]?.message ?? "Datos inválidos." }, { status: 400 });

export async function GET(request: Request) {
  if (!(await isAdmin(request))) return unauthorized();
  await connectDb();
  return NextResponse.json(await CouponModel.find().sort({ createdAt: -1 }).lean());
}

export async function POST(request: Request) {
  if (!(await isAdmin(request))) return unauthorized();
  const data = couponSchema.safeParse(await request.json());
  if (!data.success) return failure(data.error);
  await connectDb();
  if (await CouponModel.exists({ code: data.data.code })) return NextResponse.json({ error: "Ya existe un cupón con ese código." }, { status: 409 });
  return NextResponse.json(await CouponModel.create(data.data), { status: 201 });
}

/** Activar o desactivar un cupón. */
export async function PATCH(request: Request) {
  if (!(await isAdmin(request))) return unauthorized();
  const data = z.object({ code: z.string(), active: z.boolean() }).safeParse(await request.json());
  if (!data.success) return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  await connectDb();
  await CouponModel.updateOne({ code: normalizeCode(data.data.code) }, { $set: { active: data.data.active } });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  if (!(await isAdmin(request))) return unauthorized();
  const data = z.object({ code: z.string() }).safeParse(await request.json());
  if (!data.success) return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  await connectDb();
  await CouponModel.deleteOne({ code: normalizeCode(data.data.code) });
  return NextResponse.json({ ok: true });
}
