"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { CategoryTile } from "@/lib/home-categories";

export function CategoryStrip({ tiles }: { tiles: CategoryTile[] }) {
  const track = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState(false);

  // las flechas solo aparecen cuando las categorías no entran en pantalla
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const measure = () => setOverflow(el.scrollWidth > el.clientWidth + 4);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [tiles.length]);

  if (tiles.length === 0) return null;
  const scroll = (direction: number) => {
    const el = track.current;
    if (!el) return;
    const target = Math.max(0, Math.min(el.scrollLeft + direction * Math.max(el.clientWidth * 0.8, 240), el.scrollWidth - el.clientWidth));
    el.scrollTo({ left: target, behavior: "smooth" });
  };
  return <section className={`category-strip${overflow ? " scrolls" : ""}`} aria-label="Categorías">
    {overflow ? <button type="button" className="strip-arrow previous" onClick={() => scroll(-1)} aria-label="Categorías anteriores">‹</button> : null}
    <div className="strip-track" ref={track}>
      {tiles.map((tile) => <Link key={tile.name} href={`/catalogo?category=${encodeURIComponent(tile.name)}`} className="strip-item">
        <span className="strip-image">{/^https?:|^\//.test(tile.image) ? <img src={tile.image} alt="" loading="lazy" width={96} height={96} /> : <span className="strip-monogram" aria-hidden="true">{tile.name.trim().charAt(0).toUpperCase()}</span>}</span>
        <span className="strip-name">{tile.name}</span>
      </Link>)}
    </div>
    {overflow ? <button type="button" className="strip-arrow next" onClick={() => scroll(1)} aria-label="Más categorías">›</button> : null}
  </section>;
}
