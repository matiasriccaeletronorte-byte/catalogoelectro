import { connectDb } from "@/lib/db";
import { DEFAULT_TEMPLATE } from "@/lib/whatsapp";
import { SiteSettingsModel } from "@/models/SiteSettings";

export type SiteSettings = { whatsappPhone: string; whatsappTemplate: string; bbvaDates: string[] };

export async function getSiteSettings(): Promise<SiteSettings> {
  await connectDb();
  const doc = await SiteSettingsModel.findOneAndUpdate({ key: "main" }, { $setOnInsert: { key: "main" } }, { upsert: true, new: true }).lean();
  return {
    whatsappPhone: doc?.whatsappPhone ?? "",
    whatsappTemplate: doc?.whatsappTemplate || DEFAULT_TEMPLATE,
    bbvaDates: [...(doc?.bbvaDates ?? [])].sort()
  };
}
