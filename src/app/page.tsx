import { preload } from "react-dom";
import { HomePage } from "@/components/home-page";
import { JsonLd } from "@/components/json-ld";
import { storeJsonLd } from "@/lib/seo";
import { getSiteSettings } from "@/lib/site-settings";
import { siteUrl } from "@/lib/site-url";
import { connectDb } from "@/lib/db";
import { getProductsByIds } from "@/lib/catalog-query";
import { getHomepageSettings } from "@/lib/homepage-settings";
import { orderByRoots } from "@/lib/category-tree";
import { buildCategoryTiles } from "@/lib/home-categories";
import { buildHomeShelves } from "@/lib/home-shelves";
import { normalizeImageUrl } from "@/lib/image-url";
import { slideImages } from "@/lib/slide-images";
import { loadNodes } from "@/lib/category-store";
import { getMenuTree } from "@/lib/menu-tree";
import { categoryHref, findByName } from "@/lib/category-tree";

export const dynamic = "force-dynamic";

export default async function Page() {
  await connectDb();
  const settings = await getSiteSettings();
  const [shelves, tiles, homepage, treeNodes] = await Promise.all([buildHomeShelves(), buildCategoryTiles(settings.categoryImages), getHomepageSettings(), loadNodes()]);
  const categoryTiles = orderByRoots(tiles, treeNodes);
  const tree = await getMenuTree();
  const menu = tree.length > 0 ? tree : categoryTiles.map((tile) => ({ id: tile.name, name: tile.name, href: `/catalogo?category=${encodeURIComponent(tile.name)}`, count: tile.total, children: [] }));
  const featuredIds = [...new Set([...homepage.bestSellerIds, ...homepage.offerIds])];
  const featured = await getProductsByIds(featuredIds);
  const nodes = treeNodes;
  const names = [...categoryTiles.map((tile) => tile.name), ...shelves.categories.map((shelf) => shelf.name)];
  const categoryHrefs: Record<string, string> = {};
  for (const name of names) {
    const root = findByName(nodes, null, name);
    if (root) categoryHrefs[name] = categoryHref([root]);
  }
  // el banner es lo más grande de la portada: se pide ya, sin esperar a que cargue el código de la página
  const first = homepage.carouselSlides[0] ? slideImages(homepage.carouselSlides[0]) : null;
  if (first?.desktop) {
    const desktop = normalizeImageUrl(first.desktop, 1000);
    const mobile = normalizeImageUrl(first.mobile, 800);
    // cada pantalla precarga solo la suya
    if (mobile !== desktop) {
      preload(desktop, { as: "image", fetchPriority: "high", media: "(min-width: 621px)" });
      preload(mobile, { as: "image", fetchPriority: "high", media: "(max-width: 620px)" });
    } else preload(desktop, { as: "image", fetchPriority: "high" });
  }
  return <>
    <JsonLd data={storeJsonLd(siteUrl(), settings.branches, settings.whatsappPhone)} />
    <HomePage shelves={shelves} categoryTiles={categoryTiles} homepage={homepage} featured={featured} categoryHrefs={categoryHrefs} menu={menu} />
  </>;
}
