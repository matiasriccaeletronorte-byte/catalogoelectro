import { HomepageSettingsModel } from "@/models/HomepageSettings";

const homepageKey = "main";

export type HomepageSettings = {
  bestSellerIds: string[];
  offerIds: string[];
  offerTimers: { productId: string; endsAt: string }[];
  heroImages: string[];
  carouselSlides: { tag: string; title: string; text: string; image: string; mobileImage?: string }[];
  bankPromotions: { title: string; description: string; note: string }[];
};

async function getOrCreate() {
  const existing = await HomepageSettingsModel.findOne({ key: homepageKey }).lean();
  if (existing) return existing;
  const created = await HomepageSettingsModel.create({ key: homepageKey, bestSellerIds: [], offerIds: [], offerTimers: [], heroImages: [], carouselSlides: [], bankPromotions: [] });
  return created.toObject();
}

/** Ajustes de la home como datos planos (aptos para pasarlos de servidor a pantalla). */
export async function getHomepageSettings(): Promise<HomepageSettings> {
  const settings = await getOrCreate();
  return JSON.parse(JSON.stringify({
    bestSellerIds: settings.bestSellerIds ?? [],
    offerIds: settings.offerIds ?? [],
    offerTimers: settings.offerTimers ?? [],
    heroImages: settings.heroImages ?? [],
    carouselSlides: settings.carouselSlides ?? [],
    bankPromotions: settings.bankPromotions ?? []
  }));
}
