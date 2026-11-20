import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDb } from "@/lib/db";
import { isAdmin, unauthorized } from "@/lib/admin-auth";
import { HomepageSettingsModel } from "@/models/HomepageSettings";
import { normalizeImageUrl } from "@/lib/image-url";

const homepageKey = "main";

// cada pestaña del admin guarda solo lo suyo (Home o Promos bancarias): lo que no se envía no se toca
const schema = z.object({
  bestSellerIds: z.array(z.string().min(1)).max(3).optional(),
  offerIds: z.array(z.string().min(1)).max(3).optional(),
  offerTimers: z.array(z.object({ productId: z.string().min(1), endsAt: z.string().max(40).default("") })).max(3).optional(),
  heroImages: z.array(z.string().max(500)).max(10).optional(),
  carouselSlides: z.array(z.object({
    tag: z.string().max(40),
    title: z.string().max(80),
    text: z.string().max(180),
    image: z.string().max(300).regex(/^(|https:\/\/\S+|\/api\/uploads\/\S+)$/).default(""),
    mobileImage: z.string().max(300).regex(/^(|https:\/\/\S+|\/api\/uploads\/\S+)$/).default("")
  })).optional(),
  bankPromotions: z.array(z.object({
    title: z.string().max(60),
    description: z.string().max(180),
    note: z.string().max(80)
  })).max(20).optional()
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
  const { bestSellerIds, offerIds, offerTimers, heroImages, carouselSlides, bankPromotions } = payload.data;
  const set: Record<string, unknown> = { key: homepageKey };
  if (bestSellerIds) set.bestSellerIds = bestSellerIds;
  if (offerIds) set.offerIds = offerIds;
  if (offerTimers) set.offerTimers = offerIds ? offerTimers.filter((timer) => offerIds.includes(timer.productId)) : offerTimers;
  if (heroImages) set.heroImages = heroImages.map((image) => normalizeImageUrl(image));
  if (carouselSlides) set.carouselSlides = carouselSlides.map((slide) => ({ ...slide, image: normalizeImageUrl(slide.image, 1000), mobileImage: normalizeImageUrl(slide.mobileImage, 800) }));
  if (bankPromotions) set.bankPromotions = bankPromotions;
  await HomepageSettingsModel.updateOne({ key: homepageKey }, { $set: set }, { upsert: true });
  return NextResponse.json({ ok: true });
}
