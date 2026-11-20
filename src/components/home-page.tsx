"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { HomepageSettings } from "@/lib/homepage-settings";
import { useRouter } from "next/navigation";
import type { HomeShelves } from "@/lib/home-shelves";
import { ProductShelf } from "./product-shelf";
import { CategoryStrip } from "./category-strip";
import type { CategoryTile } from "@/lib/home-categories";
import { useSiteSettings } from "./site-settings-provider";
import { ProductCard } from "@/components/product-card";
import { Product } from "@/lib/types";
import { normalizeImageUrl } from "@/lib/image-url";
import { branchLocation, branchMapQuery } from "@/lib/branch-contact";

const defaultSlides = [
  {
    tag: "OFERTAS SEMANALES",
    title: "Cuotas sin interés los miércoles y sábados.",
    text: "Consultá por WhatsApp las promociones vigentes y el precio en efectivo.",
    image: ""
  },
  {
    tag: "ELECTROHOGAR",
    title: "Heladeras, lavarropas y cocinas.",
    text: "Mirá el catálogo completo y escribinos por el artículo que te interese.",
    image: ""
  },
  {
    tag: "TECNOLOGÍA",
    title: "Buscá rápido y filtrá por marca, precio y categoría.",
    text: "Más de 3000 artículos con atención personalizada en nuestras sucursales.",
    image: ""
  }
];


export function HomePage({ shelves, categoryTiles, homepage, featured, categoryHrefs }: { shelves: HomeShelves; categoryTiles: CategoryTile[]; homepage: HomepageSettings; featured: Product[]; categoryHrefs: Record<string, string> }) {
  const { branches } = useSiteSettings();
  const router = useRouter();
  const featuredProducts = featured;
  const hrefFor = (name: string) => categoryHrefs[name] ?? `/catalogo?category=${encodeURIComponent(name)}`;
  const [slide, setSlide] = useState(0);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  const carouselSlides = homepage.carouselSlides.length > 0 ? homepage.carouselSlides : defaultSlides;
  const categoriesMenu = useMemo(() => categoryTiles.map((tile) => tile.name), [categoryTiles]);
  const menuCategories = categoriesMenu.length > 0 ? categoriesMenu : ["Electrodomésticos", "Tecnología", "Hogar"];

  const indexedProducts = useMemo(() => new Map(featuredProducts.map((product) => [product.id, product])), [featuredProducts]);
  const resolveProducts = (ids: string[], fallback: Product[]) => {
    const selected = ids.map((id) => indexedProducts.get(id)).filter((item): item is Product => Boolean(item));
    return selected.length > 0 ? selected : fallback;
  };

  const bestSellers = useMemo(
    () => resolveProducts(homepage.bestSellerIds, shelves.categories.map((shelf) => shelf.items[0]).filter(Boolean)).slice(0, 6),
    [homepage.bestSellerIds, indexedProducts, featuredProducts, shelves.categories]
  );
  const offers = useMemo(() => {
    return resolveProducts(homepage.offerIds, shelves.outlet).slice(0, 6);
  }, [homepage.offerIds, indexedProducts, featuredProducts, shelves.outlet]);

  useEffect(() => {
    const timer = setInterval(() => setSlide((current) => (current + 1) % carouselSlides.length), 6000);
    return () => clearInterval(timer);
  }, [carouselSlides.length]);

  useEffect(() => {
    if (!homepage.offerTimers.some((timer) => timer.endsAt)) return;
    const timer = window.setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [homepage.offerTimers]);

  const currentSlide = carouselSlides[slide];
  const currentSlideImage = normalizeImageUrl(currentSlide.image, 1000);
  const offerTimers = useMemo(() => new Map(homepage.offerTimers.map((timer) => [timer.productId, timer.endsAt])), [homepage.offerTimers]);

  const goToCatalog = (selectedCategory: string) => {
    setOpenMenu(null);
    router.push(selectedCategory === "Todos" ? "/catalogo" : `/catalogo?category=${encodeURIComponent(selectedCategory)}`);
  };

  return (
    <main className="home">
      <h1 className="sr-only">Electronorte Outlet: electrodomésticos y tecnología en Los Polvorines</h1>
      <section className="retail-nav" aria-label="Accesos rápidos">
        <div className="retail-nav-row">
          <div className="dropdown">
            <button
              className={openMenu === "categorias" ? "dropdown-trigger active" : "dropdown-trigger"}
              type="button"
              onClick={() => setOpenMenu(openMenu === "categorias" ? null : "categorias")}
              aria-expanded={openMenu === "categorias"}
              aria-controls="categories-menu"
            >
              <span>Categorías</span>
              <strong>{openMenu === "categorias" ? "✕" : "▾"}</strong>
            </button>
            {openMenu === "categorias" ? (
              <div className="dropdown-panel" id="categories-menu">
                {menuCategories.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className="dropdown-item"
                    onClick={() => goToCatalog(item)}
                  >
                    <span>{item}</span>
                    <em>›</em>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          {bestSellers.length > 0 ? <button className="retail-link" type="button" onClick={() => document.getElementById("mas-vendidos")?.scrollIntoView({ behavior: "smooth" })}>
            Más vendidos
          </button> : null}
          {offers.length > 0 ? <button className="retail-link" type="button" onClick={() => document.getElementById("ofertas")?.scrollIntoView({ behavior: "smooth" })}>
            Ofertas
          </button> : null}
          <Link className="retail-link retail-dup" href="/catalogo?outlet=1">
            Outlet
          </Link>
          <Link className="retail-link retail-dup" href="/promos-bancarias">
            Promos bancarias
          </Link>
          <button className="retail-link" type="button" onClick={() => document.getElementById("sucursales")?.scrollIntoView({ behavior: "smooth" })}>
            Sucursales
          </button>
        </div>
      </section>

      <section className="promo-hero">
        <div className={`hero-carousel hero-carousel-wide${currentSlideImage ? " has-image" : ""}`}>
          {currentSlideImage ? (
            <div className="hero-carousel-media carousel-enter" key={`image-${slide}`}>
              <img className="hero-main" src={currentSlideImage} alt={currentSlide.title} fetchPriority="high" decoding="async" />
            </div>
          ) : null}
          {!currentSlideImage ? <span className="badge-soft hero-carousel-tag">{currentSlide.tag}</span> : null}
          <div className={`hero-carousel-content carousel-enter${currentSlideImage ? " sr-only" : ""}`} key={`content-${slide}`}>
            <h2>{currentSlide.title}</h2>
            <p>{currentSlide.text}</p>
          </div>
          {carouselSlides.length > 1 ? <>
            <button type="button" className="hero-arrow previous" onClick={() => setSlide((slide - 1 + carouselSlides.length) % carouselSlides.length)} aria-label="Slide anterior">‹</button>
            <button type="button" className="hero-arrow next" onClick={() => setSlide((slide + 1) % carouselSlides.length)} aria-label="Slide siguiente">›</button>
            <div className="hero-carousel-controls" role="group" aria-label="Elegir slide">
              {carouselSlides.map((item, index) => (
                <button
                  key={`${item.tag}-${index}`}
                  type="button"
                  className={index === slide ? "active" : ""}
                  onClick={() => setSlide(index)}
                  aria-label={`Ir al slide ${index + 1}${item.tag ? `: ${item.tag}` : ""}`}
                  aria-current={index === slide}
                />
              ))}
            </div>
          </> : null}
        </div>
      </section>

      <CategoryStrip tiles={categoryTiles} hrefFor={hrefFor} />

      <ProductShelf eyebrow="Outlet" title="Oportunidades outlet" href="/catalogo" items={shelves.outlet} />
      {shelves.categories.map((shelf) => (
        <ProductShelf key={shelf.name} eyebrow={`${shelf.total} producto${shelf.total === 1 ? "" : "s"}`} title={shelf.name} href={hrefFor(shelf.name)} items={shelf.items} />
      ))}

      {bestSellers.length > 0 ? <section id="mas-vendidos" className="offers">
        <div className="section-head offers-head">
          <div>
            <p>Más vendidos</p>
            <h2>Productos que más salen</h2>
          </div>
        </div>
        <div className="product-grid offers-grid">
          {bestSellers.map((product) => (
            <ProductCard key={`best-${product.id}`} product={product} />
          ))}
        </div>
      </section> : null}

      {offers.length > 0 ? <section id="ofertas" className="offers">
        <div className="section-head offers-head">
          <div>
            <p>Ofertas</p>
            <h2>Destacados de la semana</h2>
          </div>
          <Link href="/catalogo" className="catalog-reset">
            Ver todo el catálogo
          </Link>
        </div>
        <div className="product-grid offers-grid">
          {offers.map((product) => (
            <ProductCard key={`offer-${product.id}`} product={product} offerEndsAt={offerTimers.get(product.id)} currentTime={currentTime} />
          ))}
        </div>
      </section> : null}

      <section className="offers">
        <div className="section-head">
          <p>Catálogo</p>
          <h2>Explorá todos los productos</h2>
        </div>
        <Link href="/catalogo" className="primary-link">
          Ver catálogo completo
        </Link>
      </section>

      <section id="sucursales" className="locations">
        {branches.map((branch, index) => (
          <article className="location-card" key={`${branch.name}-${index}`}>
            <h2>{branch.name}</h2>
            <div className="location-contact">
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(branchMapQuery(branch))}`}
                target="_blank"
                rel="noreferrer"
                className="location-link"
              >
                {branchLocation(branch)}
              </a>
              <a className="location-phone location-whatsapp" href={`https://wa.me/${branch.whatsapp}`} target="_blank" rel="noreferrer" aria-label={`Escribir por WhatsApp a ${branch.name}`}>
                <span aria-hidden="true">◉</span> WhatsApp: {branch.phone}
              </a>
            </div>
            <div className="location-map">
              <iframe
                title={branch.name}
                src={`https://www.google.com/maps?q=${encodeURIComponent(branchMapQuery(branch))}&output=embed`}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </article>
        ))}

        <article className="location-card">
          <h2>Postventa y asistencia</h2>
          <p className="location-copy">
            Si necesitás ayuda con instalación, garantía o revisiones técnicas, podés escribirnos por WhatsApp y te orientamos con la mejor opción.
          </p>
          <div className="location-actions">
            <Link href="https://wa.me/541154560043" target="_blank" rel="noreferrer" className="primary-link">
              Hablar por WhatsApp
            </Link>
            <Link href="/catalogo" className="secondary-link">
              Ver productos
            </Link>
          </div>
        </article>
      </section>
    </main>
  );
}
