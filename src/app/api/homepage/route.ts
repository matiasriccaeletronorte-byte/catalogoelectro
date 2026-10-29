import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { HomepageSettingsModel } from "@/models/HomepageSettings";

const homepageKey = "main";

async function getOrCreateHomepageSettings() {
  const existing = await HomepageSettingsModel.findOne({ key: homepageKey }).lean();
  if (existing) return existing;
  const created = await HomepageSettingsModel.create({
    key: homepageKey,
    bestSellerIds: [],
    offerIds: [],
    offerTimers: [],
    heroImages: [],
    carouselSlides: [],
    bankPromotions: []
  });
  return created.toObject();
}

export async function GET() {
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
