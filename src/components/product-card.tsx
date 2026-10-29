"use client";

import Link from "next/link";
import { useState } from "react";
import { Product } from "@/lib/types";
import { normalizeImageUrl } from "@/lib/image-url";
import { useCart } from "./cart-provider";

const pesos = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

export function ProductCard({ product, offerEndsAt, currentTime = Date.now() }: { product: Product; offerEndsAt?: string; currentTime?: number }) {
  const { add } = useCart();
  const [added, setAdded] = useState(false);
  const [imageIndex, setImageIndex] = useState(0);
  const outOfStock = product.stock <= 0;
  const images = (product.images?.length ? product.images : [product.image]).filter(Boolean).map((image) => normalizeImageUrl(image));
  const image = images[imageIndex] ?? product.image;
  const isImageUrl = /^https?:\/\//i.test(image) || image.startsWith("/");
  const features = product.features?.filter(Boolean) ?? [];
  const remaining = offerEndsAt ? new Date(offerEndsAt).getTime() - currentTime : 0;
  const timer = remaining > 0 ? {
    days: Math.floor(remaining / 86400000),
    hours: Math.floor((remaining / 3600000) % 24),
    minutes: Math.floor((remaining / 60000) % 60),
    seconds: Math.floor((remaining / 1000) % 60)
  } : null;

  function addToCart() {
    add(product);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1500);
  }

  function changeImage(event: React.MouseEvent<HTMLButtonElement>, direction: number) {
    event.preventDefault();
    event.stopPropagation();
    setImageIndex((current) => (current + direction + images.length) % images.length);
  }

  return <article className={`product-card${added ? " product-added" : ""}`}>
    <div className="product-image-wrap">
      <Link href={`/productos/${product.id}`} className="product-image" aria-label={`Ver ${product.name}`}>
        {isImageUrl ? <img src={image} alt={product.name} /> : <span>{image || "📦"}</span>}
      </Link>
      {images.length > 1 ? <>
        <button type="button" className="product-image-arrow previous" onClick={(event) => changeImage(event, -1)} aria-label="Imagen anterior">‹</button>
        <button type="button" className="product-image-arrow next" onClick={(event) => changeImage(event, 1)} aria-label="Imagen siguiente">›</button>
      </> : null}
    </div>
    <div className="product-info">
      <div className="badges">{product.outlet ? <small>OUTLET</small> : null}<em>{product.category}</em>{product.subCategory ? <em>{product.subCategory}</em> : null}{product.brand ? <em>{product.brand}</em> : null}</div>
      {timer ? <div className="offer-card-timer"><span>Oferta expira en</span><b>{timer.days > 0 ? `${timer.days}d ` : ""}{String(timer.hours).padStart(2, "0")}:{String(timer.minutes).padStart(2, "0")}:{String(timer.seconds).padStart(2, "0")}</b></div> : null}
      <h3><Link href={`/productos/${product.id}`}>{product.name}</Link></h3>
      <p>{product.description}</p><strong>{pesos.format(product.price)}</strong>
      <div className="card-notes" aria-label="Características del producto">{features.length > 0 ? features.map((feature) => <span key={feature}>{feature}</span>) : <span>Consultá características y envío</span>}</div>
      <div className="card-footer"><span>{outOfStock ? "Sin stock" : `${product.stock} disponibles`}</span><button className={added ? "added-button" : ""} onClick={addToCart} disabled={outOfStock}>{outOfStock ? "Agotado" : added ? "Agregado ✓" : "Agregar"}</button></div>
    </div>
  </article>;
}
