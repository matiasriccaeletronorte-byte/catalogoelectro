"use client";

import { useEffect, useState } from "react";
import type { CatalogFilters } from "@/lib/catalog-filters";
import type { CatalogResult } from "@/lib/catalog-query";

type Props = {
  filters: CatalogFilters;
  facets?: CatalogResult["facets"];
  open: boolean;
  onClose: () => void;
  onChange: (patch: Partial<CatalogFilters>) => void;
};

export function CatalogFiltersPanel({ filters, facets, open, onClose, onChange }: Props) {
  const [min, setMin] = useState(filters.minPrice?.toString() ?? "");
  const [max, setMax] = useState(filters.maxPrice?.toString() ?? "");
  useEffect(() => { setMin(filters.minPrice?.toString() ?? ""); setMax(filters.maxPrice?.toString() ?? ""); }, [filters.minPrice, filters.maxPrice]);

  function applyPrice(event: React.FormEvent) {
    event.preventDefault();
    const toNumber = (v: string) => (v.trim() !== "" && Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : undefined);
    onChange({ minPrice: toNumber(min), maxPrice: toNumber(max) });
  }

  function toggleBrand(brand: string) {
    onChange({ brands: filters.brands.includes(brand) ? filters.brands.filter((b) => b !== brand) : [...filters.brands, brand] });
  }

  return <aside className={`categories filters-panel${open ? " open" : ""}`} aria-label="Filtros">
    <button type="button" className="filters-close" onClick={onClose}>Cerrar ✕</button>

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

    <p>Precio</p>
    <form className="facet-price" onSubmit={applyPrice}>
      <input inputMode="numeric" placeholder={facets ? String(facets.price.min) : "Mínimo"} value={min} onChange={(e) => setMin(e.target.value)} aria-label="Precio mínimo" />
      <input inputMode="numeric" placeholder={facets ? String(facets.price.max) : "Máximo"} value={max} onChange={(e) => setMax(e.target.value)} aria-label="Precio máximo" />
      <button type="submit">Aplicar</button>
    </form>

    <p>Disponibilidad</p>
    <label className="facet-check">
      <input type="checkbox" checked={filters.availableOnly} onChange={(e) => onChange({ availableOnly: e.target.checked })} />
      Solo disponibles
    </label>
  </aside>;
}
