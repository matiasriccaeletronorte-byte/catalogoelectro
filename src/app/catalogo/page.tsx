import type { Metadata } from "next";
import { Suspense } from "react";
import { Catalog } from "@/components/catalog";

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

export default function CatalogPage() {
  return <Suspense fallback={<p className="catalog-loading" role="status">Cargando catálogo…</p>}><Catalog /></Suspense>;
}
