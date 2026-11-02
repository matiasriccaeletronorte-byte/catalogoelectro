import type { MetadataRoute } from "next";
import { connectDb } from "@/lib/db";
import { siteUrl } from "@/lib/site-url";
import { ProductModel } from "@/models/Product";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const fixed: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: "daily", priority: 1 },
    { url: `${base}/catalogo`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/promos-bancarias`, changeFrequency: "weekly", priority: 0.5 }
  ];
  try {
    await connectDb();
    const active = { active: { $ne: false } };
    const [categories, products] = await Promise.all([
      ProductModel.distinct("category", { ...active, category: { $nin: ["", null] } }) as Promise<string[]>,
      ProductModel.find(active, { updatedAt: 1 }).sort({ _id: 1 }).limit(45000).lean() as unknown as Promise<{ _id: unknown; updatedAt?: Date }[]>
    ]);
    return [
      ...fixed,
      ...categories.map((name) => ({ url: `${base}/catalogo?category=${encodeURIComponent(name)}`, changeFrequency: "daily" as const, priority: 0.8 })),
      ...products.map((product) => ({ url: `${base}/productos/${String(product._id)}`, lastModified: product.updatedAt, changeFrequency: "weekly" as const, priority: 0.7 }))
    ];
  } catch {
    return fixed;
  }
}
