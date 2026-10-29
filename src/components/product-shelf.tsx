"use client";

import Link from "next/link";
import { useRef } from "react";
import type { Product } from "@/lib/types";
import { ProductCard } from "./product-card";

export function ProductShelf({ eyebrow, title, href, items }: { eyebrow: string; title: string; href: string; items: Product[] }) {
  const track = useRef<HTMLDivElement>(null);
  if (items.length === 0) return null;
  const scroll = (direction: number) => {
    const el = track.current;
    if (el) el.scrollBy({ left: direction * el.clientWidth * 0.85, behavior: "smooth" });
  };
  return <section className="offers product-shelf">
    <div className="section-head offers-head">
      <div><p>{eyebrow}</p><h2>{title}</h2></div>
      <Link href={href} className="catalog-reset">Ver todos</Link>
    </div>
    <div className="shelf-wrap">
      <button type="button" className="shelf-arrow previous" onClick={() => scroll(-1)} aria-label="Anteriores">‹</button>
      <div className="shelf-track" ref={track}>
        {items.map((product) => <div className="shelf-item" key={product.id}><ProductCard product={product} /></div>)}
      </div>
      <button type="button" className="shelf-arrow next" onClick={() => scroll(1)} aria-label="Siguientes">›</button>
    </div>
  </section>;
}
