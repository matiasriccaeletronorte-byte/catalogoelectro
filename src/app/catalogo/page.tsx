import type { Metadata } from "next";
import { Suspense } from "react";
import { Catalog } from "@/components/catalog";
import { parseFilters, serializeFilters } from "@/lib/catalog-filters";
import { runCatalogQuery } from "@/lib/catalog-query";
import { connectDb } from "@/lib/db";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const params = await searchParams;
  const category = typeof params.category === "string" ? params.category.slice(0, 80) : "";
  const filtered = Object.keys(params).some((key) => key !== "category" && key !== "page");
  const title = category ? `${category}: precios, cuotas y consulta por WhatsApp` : "Catálogo de electrodomésticos y tecnología";
  const description = category
    ? `Mirá ${category.toLowerCase()} en Electronorte, Los Polvorines. Precio en efectivo, cuotas sin interés y consulta directa por WhatsApp.`
    : "Todo el catálogo de Electronorte: electrodomésticos, tecnología y hogar con precio en efectivo, cuotas sin interés y consulta por WhatsApp.";
  return {
    title,
    description,
    alternates: { canonical: category ? `/catalogo?category=${encodeURIComponent(category)}` : "/catalogo" },
    ...(filtered ? { robots: { index: false, follow: true } } : {})
  };
}

export default async function CatalogPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) query.append(key, item);
  const filters = parseFilters(query);
  // la primera página de resultados llega ya armada: sin espera en blanco ni saltos al cargar
  let initialResult = null;
  try {
    await connectDb();
    initialResult = JSON.parse(JSON.stringify(await runCatalogQuery(filters)));
  } catch {
    initialResult = null;
  }
  return <Suspense fallback={<p className="catalog-loading" role="status">Cargando catálogo…</p>}>
    <Catalog initialResult={initialResult} initialQuery={serializeFilters(filters).toString()} />
  </Suspense>;
}
