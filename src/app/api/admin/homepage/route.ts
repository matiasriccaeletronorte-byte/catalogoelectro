import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDb } from "@/lib/db";
import { isAdmin, unauthorized } from "@/lib/admin-auth";
import { HomepageSettingsModel } from "@/models/HomepageSettings";
import { normalizeImageUrl } from "@/lib/image-url";

const homepageKey = "main";

const schema = z.object({
  bestSellerIds: z.array(z.string().min(1)).max(3).default([]),
  offerIds: z.array(z.string().min(1)).max(3).default([]),
  offerTimers: z.array(z.object({ productId: z.string().min(1), endsAt: z.string().max(40).default("") })).max(3).default([]),
  heroImages: z.array(z.string().max(500)).max(10).default([]),
  carouselSlides: z.array(z.object({
    tag: z.string().max(40),
    title: z.string().max(80),
    text: z.string().max(180),
    image: z.string().max(300).default("")
  })).default([]),
  bankPromotions: z.array(z.object({
    title: z.string().max(60),
    description: z.string().max(180),
    note: z.string().max(80)
  })).default([])
});

async function getOrCreateHomepageSettings() {
  const existing = await HomepageSettingsModel.findOne({ key: homepageKey });
  if (existing) return existing;
  return HomepageSettingsModel.create({ key: homepageKey, bestSellerIds: [], offerIds: [], offerTimers: [], heroImages: [], carouselSlides: [], bankPromotions: [] });
}

export async function GET(request: Request) {
  if (!(await isAdmin(request))) return unauthorized();
  await connectDb();
  const settings = await getOrCreateHomepageSettings();
  return NextResponse.json({
    bestSellerIds: settings.bestSellerIds ?? [],
    offerIds: settings.offerIds ?? [],
    offerTimers: settings.offerTimers ?? [],
    heroImages: settings.heroImages ?? [],
    carouselSlides: settings.carouselSlides ?? [],
    bankPromotions: settings.bankPromotions ?? []
  });
}

export async function PUT(request: Request) {
  if (!(await isAdmin(request))) return unauthorized();
  const payload = schema.safeParse(await request.json());
  if (!payload.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  await connectDb();
  await HomepageSettingsModel.updateOne(
    { key: homepageKey },
    {
      $set: {
        key: homepageKey,
        bestSellerIds: payload.data.bestSellerIds,
        offerIds: payload.data.offerIds,
        offerTimers: payload.data.offerTimers.filter((timer) => payload.data.offerIds.includes(timer.productId)),
        heroImages: payload.data.heroImages.map((image) => normalizeImageUrl(image)),
        carouselSlides: payload.data.carouselSlides.map((slide) => ({ ...slide, image: normalizeImageUrl(slide.image, 1000) })),
        bankPromotions: payload.data.bankPromotions
      }
    },
    { upsert: true }
  );
  return NextResponse.json({ ok: true });
}
