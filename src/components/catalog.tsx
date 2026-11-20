"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CatalogFilters, PAGE_SIZE, parseFilters, serializeFilters, SortKey } from "@/lib/catalog-filters";
import type { CatalogResult } from "@/lib/catalog-query";
import { CatalogFiltersPanel } from "./catalog-filters-panel";
import { ProductCard } from "./product-card";
import { Breadcrumb } from "./breadcrumb";
import { categoryHref } from "@/lib/category-tree";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [{ key: "price_asc", label: "Menor precio" }, { key: "price_desc", label: "Mayor precio" }];
const pesos = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

export type CatalogNode = { id: string; name: string; pathSlugs: string[]; trail: { name: string; href: string }[] };

export function Catalog({ node = null, initialResult = null, initialQuery = "" }: { node?: CatalogNode | null; initialResult?: CatalogResult | null; initialQuery?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filters = { ...parseFilters(new URLSearchParams(searchParams.toString())), categoryId: node?.id ?? "" };
  const basePath = node ? categoryHref(node.pathSlugs.map((slug) => ({ slug }))) : "/catalogo";
  const parentHref = node && node.pathSlugs.length > 1 ? categoryHref(node.pathSlugs.slice(0, -1).map((slug) => ({ slug }))) : "/catalogo";
  const linkSuffix = serializeFilters({ ...filters, categoryId: "", category: "", subCategory: "", page: 1 }).toString();
  const queryString = serializeFilters(filters).toString();
  const [result, setResult] = useState<CatalogResult | null>(initialResult);
  const [loading, setLoading] = useState(initialResult === null);
  const servedFromServer = useRef(initialResult !== null ? initialQuery : null);
  const [error, setError] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);

  useEffect(() => {
    // la primera vez, el servidor ya mandó estos resultados: no se piden de nuevo
    if (servedFromServer.current === queryString) { servedFromServer.current = null; return; }
    servedFromServer.current = null;
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
    const next = { ...filters, page: 1, ...patch, categoryId: "" };
    const qs = serializeFilters(next).toString();
    window.history.pushState(null, "", qs ? `${basePath}?${qs}` : basePath);
  }

  const chips: { label: string; remove: () => void }[] = [];
  if (filters.q) chips.push({ label: `“${filters.q}”`, remove: () => update({ q: "" }) });
  if (node) chips.push({ label: node.name, remove: () => router.push(parentHref) });
  if (filters.category) chips.push({ label: filters.category, remove: () => update({ category: "", subCategory: "" }) });
  if (filters.subCategory) chips.push({ label: filters.subCategory, remove: () => update({ subCategory: "" }) });
  filters.brands.forEach((brand) => chips.push({ label: brand, remove: () => update({ brands: filters.brands.filter((b) => b !== brand) }) }));
  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
    const label = `${filters.minPrice !== undefined ? pesos.format(filters.minPrice) : "Desde $0"} – ${filters.maxPrice !== undefined ? pesos.format(filters.maxPrice) : "sin tope"}`;
    chips.push({ label, remove: () => update({ minPrice: undefined, maxPrice: undefined }) });
  }
  const sortLabel = SORT_OPTIONS.find((o) => o.key === filters.sort)?.label;
  if (sortLabel) chips.push({ label: sortLabel, remove: () => update({ sort: "relevance" }) });
  if (filters.outletOnly) chips.push({ label: "Outlet", remove: () => update({ outletOnly: false }) });
  if (filters.availableOnly) chips.push({ label: "Solo disponibles", remove: () => update({ availableOnly: false }) });

  const totalPages = result ? Math.max(1, Math.ceil(result.total / PAGE_SIZE)) : 1;

  return <main className="catalog catalog-page">
    <div className="catalog-mobile-bar">
      <button type="button" aria-expanded={panelOpen} onClick={() => setPanelOpen(!panelOpen)}>Filtros{chips.length ? ` (${chips.length})` : ""} {panelOpen ? "▴" : "▾"}</button>
    </div>
    <CatalogFiltersPanel filters={filters} facets={result?.facets} open={panelOpen} onChange={update} node={node} suffix={linkSuffix} />
    <div className="catalog-content">
      <div className="catalog-toolbar">
        <div className="section-head">
          {node ? <Breadcrumb trail={[{ name: "Inicio", href: "/" }, { name: "Catálogo", href: "/catalogo" }, ...node.trail.slice(0, -1), { name: node.name }]} /> : null}
          <h1>{node?.name || filters.category || (filters.outletOnly ? "Outlet" : "Todos los productos")}</h1>
          <div className="catalog-summary">{result ? <span><strong>{result.total}</strong> producto{result.total === 1 ? "" : "s"}</span> : null}</div>
        </div>
        <label className="catalog-sort">Ordenar por
          <select value={SORT_OPTIONS.some((o) => o.key === filters.sort) ? filters.sort : ""} onChange={(e) => update({ sort: e.target.value as SortKey })}>
            <option value="" disabled>Elegir…</option>
            {SORT_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
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
