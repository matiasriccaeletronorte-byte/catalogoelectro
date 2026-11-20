import { preload } from "react-dom";
import { HomePage } from "@/components/home-page";
import { JsonLd } from "@/components/json-ld";
import { storeJsonLd } from "@/lib/seo";
import { getSiteSettings } from "@/lib/site-settings";
import { siteUrl } from "@/lib/site-url";
import { connectDb } from "@/lib/db";
import { getProductsByIds } from "@/lib/catalog-query";
import { getHomepageSettings } from "@/lib/homepage-settings";
import { buildCategoryTiles } from "@/lib/home-categories";
import { buildHomeShelves } from "@/lib/home-shelves";
import { normalizeImageUrl } from "@/lib/image-url";
import { loadNodes } from "@/lib/category-store";
import { categoryHref, findByName } from "@/lib/category-tree";

export const dynamic = "force-dynamic";

export default async function Page() {
  await connectDb();
  const settings = await getSiteSettings();
  const [shelves, categoryTiles, homepage] = await Promise.all([buildHomeShelves(), buildCategoryTiles(settings.categoryImages), getHomepageSettings()]);
  const featuredIds = [...new Set([...homepage.bestSellerIds, ...homepage.offerIds])];
  const featured = await getProductsByIds(featuredIds);
  const nodes = await loadNodes();
  const names = [...categoryTiles.map((tile) => tile.name), ...shelves.categories.map((shelf) => shelf.name)];
  const categoryHrefs: Record<string, string> = {};
  for (const name of names) {
    const root = findByName(nodes, null, name);
    if (root) categoryHrefs[name] = categoryHref([root]);
  }
  // el banner es lo más grande de la portada: se pide ya, sin esperar a que cargue el código de la página
  const firstBanner = homepage.carouselSlides[0]?.image;
  if (firstBanner) preload(normalizeImageUrl(firstBanner, 1000), { as: "image", fetchPriority: "high" });
  return <>
    <JsonLd data={storeJsonLd(siteUrl(), settings.branches, settings.whatsappPhone)} />
    <HomePage shelves={shelves} categoryTiles={categoryTiles} homepage={homepage} featured={featured} categoryHrefs={categoryHrefs} />
  </>;
}
