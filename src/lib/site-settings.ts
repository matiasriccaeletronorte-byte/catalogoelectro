import { connectDb } from "@/lib/db";
import { Branch, branchesOrDefault } from "@/lib/branches";
import { DEFAULT_TEMPLATE } from "@/lib/whatsapp";
import { SiteSettingsModel } from "@/models/SiteSettings";

export type SiteSettings = { whatsappPhone: string; whatsappTemplate: string; bbvaDates: string[]; branches: Branch[] };

export async function getSiteSettings(): Promise<SiteSettings> {
  await connectDb();
  const doc = await SiteSettingsModel.findOneAndUpdate({ key: "main" }, { $setOnInsert: { key: "main" } }, { upsert: true, new: true }).lean() as Partial<SiteSettings> | null;
  return {
    whatsappPhone: doc?.whatsappPhone ?? "",
    whatsappTemplate: doc?.whatsappTemplate || DEFAULT_TEMPLATE,
    bbvaDates: [...(doc?.bbvaDates ?? [])].sort(),
    branches: branchesOrDefault(doc?.branches)
  };
}
