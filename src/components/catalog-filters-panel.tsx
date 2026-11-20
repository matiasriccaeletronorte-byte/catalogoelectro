"use client";

import Link from "next/link";
import type { CatalogFilters } from "@/lib/catalog-filters";
import { categoryHref } from "@/lib/category-tree";
import type { CatalogNode } from "./catalog";
import type { CatalogResult } from "@/lib/catalog-query";

type Props = {
  filters: CatalogFilters;
  facets?: CatalogResult["facets"];
  open: boolean;
  onChange: (patch: Partial<CatalogFilters>) => void;
  node: CatalogNode | null;
  suffix: string;
};

export function CatalogFiltersPanel({ filters, facets, open, onChange, node, suffix }: Props) {
  const hrefFor = (slugs: string[]) => `${categoryHref(slugs.map((slug) => ({ slug })))}${suffix ? `?${suffix}` : ""}`;
  const legacy = !node && facets !== undefined && facets.categoryChildren.length === 0;

  function toggleBrand(brand: string) {
    onChange({ brands: filters.brands.includes(brand) ? filters.brands.filter((b) => b !== brand) : [...filters.brands, brand] });
  }

  return <aside className={`categories filters-panel${open ? " open" : ""}`} aria-label="Filtros">
    <label className="facet-check facet-outlet">
      <input type="checkbox" checked={filters.outletOnly} onChange={(e) => onChange({ outletOnly: e.target.checked })} />
      <b>Solo Outlet</b>
    </label>

    <p>Categorías</p>
    {node ? <Link prefetch={false} className="facet-back" href={hrefFor(node.pathSlugs.slice(0, -1))}>← {node.pathSlugs.length > 1 ? node.trail[node.trail.length - 2].name : "Todas las categorías"}</Link> : null}
    {node ? <b className="facet-current">{node.name}</b> : null}
    {facets?.categoryChildren.map((child) => (
      <Link prefetch={false} key={child.id} className="facet-sub-link" href={hrefFor([...(node?.pathSlugs ?? []), child.slug])}>{child.name}<span>{child.count}</span></Link>
    ))}
    {legacy ? <>
      {filters.category ? <button type="button" className="facet-back" onClick={() => onChange({ category: "", subCategory: "" })}>← Todas las categorías</button> : null}
      {facets?.categories.filter((c) => !filters.category || c.value === filters.category).map((c) => (
        <button type="button" key={c.value} className={filters.category === c.value ? "selected" : ""} onClick={() => onChange({ category: c.value, subCategory: "" })}>
          {c.value}<span>{c.count}</span>
        </button>
      ))}
      {filters.category ? facets?.subCategories.map((s) => (
        <button type="button" key={s.value} className={`facet-sub${filters.subCategory === s.value ? " selected" : ""}`} onClick={() => onChange({ subCategory: filters.subCategory === s.value ? "" : s.value })}>
          {s.value}<span>{s.count}</span>
        </button>
      )) : null}
    </> : null}

    {facets && facets.brands.length > 0 ? <>
      <p>Marca</p>
      {facets.brands.map((b) => (
        <label className="facet-check" key={b.value}>
          <input type="checkbox" checked={filters.brands.includes(b.value)} onChange={() => toggleBrand(b.value)} />
          {b.value}<span>{b.count}</span>
        </label>
      ))}
    </> : null}
  </aside>;
}
