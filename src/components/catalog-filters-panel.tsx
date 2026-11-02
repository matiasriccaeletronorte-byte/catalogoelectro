"use client";

import type { CatalogFilters } from "@/lib/catalog-filters";
import type { CatalogResult } from "@/lib/catalog-query";

type Props = {
  filters: CatalogFilters;
  facets?: CatalogResult["facets"];
  open: boolean;
  onChange: (patch: Partial<CatalogFilters>) => void;
};

export function CatalogFiltersPanel({ filters, facets, open, onChange }: Props) {
  function toggleBrand(brand: string) {
    onChange({ brands: filters.brands.includes(brand) ? filters.brands.filter((b) => b !== brand) : [...filters.brands, brand] });
  }

  return <aside className={`categories filters-panel${open ? " open" : ""}`} aria-label="Filtros">
    <p>Categorías</p>
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
