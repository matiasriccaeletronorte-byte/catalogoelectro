import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { Suspense } from "react";
import { Catalog, type CatalogNode } from "@/components/catalog";
import { JsonLd } from "@/components/json-ld";
import { parseFilters, serializeFilters } from "@/lib/catalog-filters";
import { runCatalogQuery } from "@/lib/catalog-query";
import { loadNodes } from "@/lib/category-store";
import { categoryHref, legacyCategoryHref, nodePath, resolveSlugs } from "@/lib/category-tree";
import { connectDb } from "@/lib/db";
import { breadcrumbJsonLd } from "@/lib/seo";
import { siteUrl } from "@/lib/site-url";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type Params = Promise<{ path?: string[] }>;

function toQuery(params: Record<string, string | string[] | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) query.append(key, item);
  return query;
}

export async function generateMetadata({ params, searchParams }: { params: Params; searchParams: SearchParams }): Promise<Metadata> {
  const slugs = (await params).path ?? [];
  const query = await searchParams;
  await connectDb();
  const nodes = await loadNodes();
  const node = slugs.length ? resolveSlugs(nodes, slugs) : null;
  if (slugs.length && !node) return { title: "Categoría no encontrada", robots: { index: false } };
  const legacy = typeof query.category === "string" ? query.category.slice(0, 80) : "";
  const name = node?.name ?? legacy;
  const filtered = Object.keys(query).some((key) => key !== "page");
  const title = name ? `${name}: precios, cuotas y consulta por WhatsApp` : "Catálogo de electrodomésticos y tecnología";
  const description = name
    ? `Mirá ${name.toLowerCase()} en Electronorte, Los Polvorines. Precio en efectivo, cuotas sin interés y consulta directa por WhatsApp.`
    : "Todo el catálogo de Electronorte: electrodomésticos, tecnología y hogar con precio en efectivo, cuotas sin interés y consulta por WhatsApp.";
  return {
    title,
    description,
    alternates: { canonical: node ? categoryHref(nodePath(nodes, node.id)) : "/catalogo" },
    ...(filtered ? { robots: { index: false, follow: true } } : {})
  };
}

export default async function CatalogPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const slugs = (await params).path ?? [];
  const query = toQuery(await searchParams);
  await connectDb();
  const nodes = await loadNodes();
  const node = slugs.length ? resolveSlugs(nodes, slugs) : null;
  if (slugs.length && !node) notFound();

  // enlaces viejos ?category=… → dirección por camino (si la categoría ya existe en el árbol)
  const legacyName = (query.get("category") ?? "").trim();
  if (!slugs.length && legacyName) {
    const target = legacyCategoryHref(nodes, legacyName, query.get("subCategory") ?? "");
    if (target) {
      query.delete("category");
      query.delete("subCategory");
      const rest = query.toString();
      permanentRedirect(`${target}${rest ? `?${rest}` : ""}`);
    }
  }

  const filters = { ...parseFilters(query), categoryId: node?.id ?? "" };
  // la primera página de resultados llega ya armada: sin espera en blanco ni saltos al cargar
  let initialResult = null;
  try {
    initialResult = JSON.parse(JSON.stringify(await runCatalogQuery(filters)));
  } catch {
    initialResult = null;
  }
  const trail = node ? nodePath(nodes, node.id) : [];
  const catalogNode: CatalogNode | null = node
    ? { id: node.id, name: node.name, pathSlugs: trail.map((item) => item.slug), trail: trail.map((item, index) => ({ name: item.name, href: categoryHref(trail.slice(0, index + 1)) })) }
    : null;
  const base = siteUrl();
  return <>
    {catalogNode ? <JsonLd data={breadcrumbJsonLd(base, [{ name: "Inicio", path: "/" }, { name: "Catálogo", path: "/catalogo" }, ...catalogNode.trail.map((crumb) => ({ name: crumb.name, path: crumb.href }))])} /> : null}
    <Suspense fallback={<p className="catalog-loading" role="status">Cargando catálogo…</p>}>
      <Catalog key={node?.id ?? "todos"} node={catalogNode} initialResult={initialResult} initialQuery={serializeFilters(filters).toString()} />
    </Suspense>
  </>;
}
