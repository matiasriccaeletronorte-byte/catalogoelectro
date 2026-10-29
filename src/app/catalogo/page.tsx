import { Suspense } from "react";
import { Catalog } from "@/components/catalog";

export const metadata = { title: "Catálogo | Electronorte" };

export default function CatalogPage() {
  return <Suspense fallback={<p>Cargando…</p>}><Catalog /></Suspense>;
}
