"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CatalogFilters, PAGE_SIZE, parseFilters, serializeFilters, SortKey } from "@/lib/catalog-filters";
import type { CatalogResult } from "@/lib/catalog-query";
import { CatalogFiltersPanel } from "./catalog-filters-panel";
import { ProductCard } from "./product-card";

const SORT_LABELS: Record<SortKey, string> = { relevance: "Más relevantes", price_asc: "Menor precio", price_desc: "Mayor precio", newest: "Más nuevos" };
const pesos = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

export function Catalog() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filters = parseFilters(new URLSearchParams(searchParams.toString()));
  const queryString = serializeFilters(filters).toString();
  const [result, setResult] = useState<CatalogResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    fetch(`/api/products?${queryString}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("No se pudo cargar el catálogo."))))
      .then((data: CatalogResult) => { setResult(data); setError(""); })
      .catch((err) => { if (err.name !== "AbortError") setError(err.message); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [queryString]);

  function update(patch: Partial<CatalogFilters>) {
    const next = { ...filters, page: 1, ...patch };
    const qs = serializeFilters(next).toString();
    router.push(qs ? `/catalogo?${qs}` : "/catalogo", { scroll: false });
  }

  const chips: { label: string; remove: () => void }[] = [];
  if (filters.q) chips.push({ label: `“${filters.q}”`, remove: () => update({ q: "" }) });
  if (filters.category) chips.push({ label: filters.category, remove: () => update({ category: "", subCategory: "" }) });
  if (filters.subCategory) chips.push({ label: filters.subCategory, remove: () => update({ subCategory: "" }) });
  filters.brands.forEach((brand) => chips.push({ label: brand, remove: () => update({ brands: filters.brands.filter((b) => b !== brand) }) }));
  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
    const label = `${filters.minPrice !== undefined ? pesos.format(filters.minPrice) : "Desde $0"} – ${filters.maxPrice !== undefined ? pesos.format(filters.maxPrice) : "sin tope"}`;
    chips.push({ label, remove: () => update({ minPrice: undefined, maxPrice: undefined }) });
  }
  if (filters.availableOnly) chips.push({ label: "Solo disponibles", remove: () => update({ availableOnly: false }) });

  const totalPages = result ? Math.max(1, Math.ceil(result.total / PAGE_SIZE)) : 1;

  return <main className="catalog catalog-page">
    <div className="catalog-mobile-bar">
      <button type="button" onClick={() => setPanelOpen(true)}>Filtros{chips.length ? ` (${chips.length})` : ""}</button>
    </div>
    <CatalogFiltersPanel filters={filters} facets={result?.facets} open={panelOpen} onClose={() => setPanelOpen(false)} onChange={update} />
    <div className="catalog-content">
      <div className="catalog-toolbar">
        <div className="section-head">
          <p>Catálogo</p>
          <h1>{filters.category || "Todos los productos"}</h1>
          <div className="catalog-summary">{result ? <span><strong>{result.total}</strong> producto{result.total === 1 ? "" : "s"}</span> : null}</div>
        </div>
        <label className="catalog-sort">Ordenar por
          <select value={filters.sort} onChange={(e) => update({ sort: e.target.value as SortKey })}>
            {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => <option key={key} value={key}>{SORT_LABELS[key]}</option>)}
          </select>
        </label>
      </div>
      {chips.length > 0 ? <div className="filter-chips">
        {chips.map((chip) => <button type="button" key={chip.label} onClick={chip.remove}>{chip.label} <span aria-hidden>×</span></button>)}
        <button type="button" className="chips-clear" onClick={() => router.push("/catalogo", { scroll: false })}>Limpiar todo</button>
      </div> : null}
      {error ? <p className="error">{error}</p>
        : loading && !result ? <p>Cargando catálogo…</p>
        : result && result.items.length === 0 ? <div className="empty-state">No encontramos productos con esos filtros. Probá quitar alguno.</div>
        : <div className={`product-grid${loading ? " is-loading" : ""}`}>{result?.items.map((product) => <ProductCard key={product.id} product={product} />)}</div>}
      {result && result.total > PAGE_SIZE ? <div className="catalog-pagination">
        <button type="button" disabled={filters.page <= 1} onClick={() => update({ page: filters.page - 1 })}>Anterior</button>
        <span>Página {filters.page} de {totalPages}</span>
        <button type="button" disabled={filters.page >= totalPages} onClick={() => update({ page: filters.page + 1 })}>Siguiente</button>
      </div> : null}
    </div>
  </main>;
}
