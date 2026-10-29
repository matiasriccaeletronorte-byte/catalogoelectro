"use client";

import Link from "next/link";
import { useState } from "react";
import { Product } from "@/lib/types";
import { normalizeImageUrl } from "@/lib/image-url";
import { useCart } from "./cart-provider";

const pesos = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

export function ProductDetail({ product }: { product: Product }) {
  const { add } = useCart();
  const images = (product.images?.length ? product.images : [product.image]).filter(Boolean).map((image) => normalizeImageUrl(image));
  const [activeImage, setActiveImage] = useState(0); const [added, setAdded] = useState(false);
  const outOfStock = product.stock <= 0;
  const image = images[activeImage] ?? "";
  function addToCart() { add(product); setAdded(true); window.setTimeout(() => setAdded(false), 1500); }
  return <main className="product-page"><nav className="product-breadcrumb"><Link href="/">Inicio</Link><span>›</span><Link href="/#catalogo">{product.category}</Link><span>›</span><b>{product.name}</b></nav><section className="product-detail-layout"><div className="product-gallery"><div className="product-main-image">{image && (/^https?:|^\//.test(image) ? <img src={image} alt={product.name} /> : <span>{image || "📦"}</span>)}</div>{images.length > 1 && <div className="product-thumbnails">{images.map((item, index) => <button className={index === activeImage ? "active" : ""} onClick={() => setActiveImage(index)} key={`${item}-${index}`}><img src={item} alt={`Vista ${index + 1} de ${product.name}`}/></button>)}</div>}</div><aside className="product-buy-box"><div className="badges">{product.outlet && <small>OUTLET</small>}<em>{product.category}</em>{product.brand && <em>{product.brand}</em>}</div><h1>{product.name}</h1><p className="product-sku">{product.sku ? `SKU: ${product.sku}` : "Producto Electronorte"}</p><div className="product-price">{pesos.format(product.price)}</div><p className={outOfStock ? "stock-out" : "stock-ok"}>{outOfStock ? "Sin stock disponible" : `${product.stock} unidades disponibles`}</p><button className={`product-add-button${added ? " added-button" : ""}`} onClick={addToCart} disabled={outOfStock}>{outOfStock ? "Producto agotado" : added ? "Agregado al carrito ✓" : "Agregar al carrito"}</button><div className="product-service"><b>Compra acompañada</b><span>Confirmamos stock y envío antes de coordinar el pago.</span></div></aside></section><section className="product-information"><div><h2>Características</h2>{product.features?.length ? <ul>{product.features.map((feature) => <li key={feature}>{feature}</li>)}</ul> : <p>Consultá las características técnicas con nuestro equipo.</p>}</div><div><h2>Descripción</h2><p>{product.description}</p>{product.subCategory && <p><b>Subcategoría:</b> {product.subCategory}</p>}</div></section></main>;
}
