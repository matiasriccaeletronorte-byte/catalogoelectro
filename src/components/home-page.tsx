"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ProductCard } from "@/components/product-card";
import { Product } from "@/lib/types";
import { normalizeImageUrl } from "@/lib/image-url";

type HomepageSettings = {
  bestSellerIds: string[];
  offerIds: string[];
  offerTimers: { productId: string; endsAt: string }[];
  heroImages: string[];
  carouselSlides: { tag: string; title: string; text: string; image: string }[];
  bankPromotions: { title: string; description: string; note: string }[];
};

const defaultSlides = [
  {
    tag: "OFERTAS SEMANALES",
    title: "Promociones con stock real y salida rápida.",
    text: "Un bloque limpio para destacar campañas sin cargar la home de elementos innecesarios.",
    image: ""
  },
  {
    tag: "ELECTROHOGAR",
    title: "Heladeras, lavarropas y cocinas con foco comercial.",
    text: "Una estructura de tienda real, con acceso rápido a categorías y secciones importantes.",
    image: ""
  },
  {
    tag: "TECNOLOGÍA",
    title: "Buscá rápido, filtrá mejor y comprá con confianza.",
    text: "Diseño más cercano a un retail grande, con navegación clara y producto visible.",
    image: ""
  }
];

const branchLocations = [
  {
    name: "Rivadavia 1743",
    city: "Los Polvorines, Buenos Aires",
    phone: "011 2174-3430",
    whatsapp: "5491121743430",
    query: "Rivadavia 1743 Los Polvorines Buenos Aires"
  },
  {
    name: "Av. Sesquicentenario 1106",
    city: "Los Polvorines, Buenos Aires",
    phone: "011 5456-0043",
    whatsapp: "5491154560043",
    query: "Av. Sesquicentenario 1106 Los Polvorines Buenos Aires"
  }
];

export function HomePage() {
  const router = useRouter();
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>(["Todos"]);
  const [homepage, setHomepage] = useState<HomepageSettings>({
    bestSellerIds: [],
    offerIds: [],
    offerTimers: [],
    heroImages: [],
    carouselSlides: [],
    bankPromotions: []
  });
  const [error, setError] = useState("");
  const [slide, setSlide] = useState(0);
  const [heroImage, setHeroImage] = useState(0);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  useEffect(() => {
    fetch("/api/homepage")
      .then((res) => (res.ok ? res.json() : { bestSellerIds: [], offerIds: [], offerTimers: [], heroImages: [], carouselSlides: [], bankPromotions: [] }))
      .then((homepageData) => {
        setHomepage({
          bestSellerIds: homepageData.bestSellerIds ?? [],
          offerIds: homepageData.offerIds ?? [],
          offerTimers: homepageData.offerTimers ?? [],
          heroImages: homepageData.heroImages ?? [],
          carouselSlides: homepageData.carouselSlides ?? [],
          bankPromotions: homepageData.bankPromotions ?? []
        });
        const featuredIds = [...new Set([...(homepageData.bestSellerIds ?? []), ...(homepageData.offerIds ?? [])])];
        if (featuredIds.length) fetch(`/api/products?ids=${featuredIds.join(",")}`).then((res) => res.ok ? res.json() : { items: [] }).then((data) => setFeaturedProducts(data.items ?? []));
      })
      .catch(() => setError("No se pudo cargar el catálogo. Verificá la conexión a MongoDB."));
  }, []);

  useEffect(() => {
    fetch("/api/products")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setCategories(["Todos", ...(data.facets?.categories ?? []).map((c: { value: string }) => c.value)]))
      .catch(() => setError("No se pudo cargar el catálogo. Verificá la conexión a la base de datos."));
  }, []);

  const carouselSlides = homepage.carouselSlides.length > 0 ? homepage.carouselSlides : defaultSlides;
  const categoriesMenu = useMemo(() => categories.filter((item) => item !== "Todos"), [categories]);
  const menuCategories = categoriesMenu.length > 0 ? categoriesMenu : ["Electrodomésticos", "Tecnología", "Hogar"];

  const indexedProducts = useMemo(() => new Map(featuredProducts.map((product) => [product.id, product])), [featuredProducts]);
  const resolveProducts = (ids: string[], fallback: Product[]) => {
    const selected = ids.map((id) => indexedProducts.get(id)).filter((item): item is Product => Boolean(item));
    return selected.length > 0 ? selected : fallback;
  };

  const bestSellers = useMemo(
    () => resolveProducts(homepage.bestSellerIds, featuredProducts.slice(0, 3)).slice(0, 3),
    [homepage.bestSellerIds, indexedProducts, featuredProducts]
  );
  const offers = useMemo(() => {
    const fallback = (featuredProducts.filter((product) => product.outlet).length ? featuredProducts.filter((product) => product.outlet) : featuredProducts).slice(0, 3);
    return resolveProducts(homepage.offerIds, fallback).slice(0, 3);
  }, [homepage.offerIds, indexedProducts, featuredProducts]);

  useEffect(() => {
    const timer = setInterval(() => setSlide((current) => (current + 1) % carouselSlides.length), 6000);
    return () => clearInterval(timer);
  }, [carouselSlides.length]);

  useEffect(() => {
    setHeroImage(0);
    if (homepage.heroImages.length < 2) return;
    const timer = window.setInterval(() => setHeroImage((current) => (current + 1) % homepage.heroImages.length), 5000);
    return () => window.clearInterval(timer);
  }, [homepage.heroImages]);

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
          <button className="retail-link" type="button" onClick={() => document.getElementById("mas-vendidos")?.scrollIntoView({ behavior: "smooth" })}>
            Más vendidos
          </button>
          <button className="retail-link" type="button" onClick={() => document.getElementById("ofertas")?.scrollIntoView({ behavior: "smooth" })}>
            Ofertas
          </button>
          <Link className="retail-link" href="/promos-bancarias">
            Promos bancarias
          </Link>
          <button className="retail-link" type="button" onClick={() => document.getElementById("sucursales")?.scrollIntoView({ behavior: "smooth" })}>
            Sucursales
          </button>
        </div>
      </section>

      <section className="promo-hero">
        <div className="hero-carousel hero-carousel-wide">
          <div className="hero-carousel-top">
            <span className="badge-soft">{currentSlide.tag}</span>
            <div className="hero-carousel-controls" aria-label="Cambiar slide">
              {carouselSlides.map((item, index) => (
                <button
                  key={`${item.tag}-${index}`}
                  type="button"
                  className={index === slide ? "active" : ""}
                  onClick={() => setSlide(index)}
                  aria-label={item.tag}
                />
              ))}
            </div>
          </div>
          {currentSlideImage ? (
            <div className="hero-carousel-media carousel-enter" key={`image-${slide}`}>
              <img src={currentSlideImage} alt={currentSlide.title} />
            </div>
          ) : null}
          <div className="hero-carousel-content carousel-enter" key={`content-${slide}`}>
            <h2>{currentSlide.title}</h2>
            <p>{currentSlide.text}</p>
          </div>
          <div className="hero-carousel-footer">
            <span>Campañas destacadas</span>
            <span>Stock sujeto a disponibilidad</span>
          </div>
        </div>
      </section>

      <section className="hero">
        <div className="hero-copy hero-copy-balanced">
          <div className="hero-copy-content">
            <p className="eyebrow">Electronorte Outlet</p>
            <h1>Electrodomésticos y tecnología con una experiencia de compra clara.</h1>
            <p className="hero-lead">
              Un catálogo simple de recorrer, con stock visible, filtros útiles y una estética más cercana a los e-commerce que ya conocen tus clientes.
            </p>
          </div>

          <div className="hero-feature-grid compact" aria-label="Beneficios de compra">
            <article>
              <strong>Compra rápida</strong>
              <p>Buscá desde el header y filtrá desde el catálogo.</p>
            </article>
            <article>
              <strong>Confianza</strong>
              <p>Precio, categoría y stock al frente.</p>
            </article>
            <article>
              <strong>Outlet</strong>
              <p>Productos con foco en oportunidad y disponibilidad.</p>
            </article>
            <article>
              <strong>Asesoramiento</strong>
              <p>Seguimos mostrando el lado humano de la marca.</p>
            </article>
          </div>

          <div className="hero-team-carousel" aria-label="Nuestro local y equipo">
            {homepage.heroImages.length > 0 ? <>
              <img key={`${homepage.heroImages[heroImage]}-${heroImage}`} className="carousel-enter" src={normalizeImageUrl(homepage.heroImages[heroImage])} alt="Electronorte: local o equipo" />
              {homepage.heroImages.length > 1 ? <>
                <button type="button" className="hero-team-arrow previous" onClick={() => setHeroImage((current) => (current - 1 + homepage.heroImages.length) % homepage.heroImages.length)} aria-label="Foto anterior">‹</button>
                <button type="button" className="hero-team-arrow next" onClick={() => setHeroImage((current) => (current + 1) % homepage.heroImages.length)} aria-label="Foto siguiente">›</button>
                <div className="hero-team-dots">{homepage.heroImages.map((image, index) => <button type="button" key={`${image}-${index}`} onClick={() => setHeroImage(index)} className={index === heroImage ? "active" : ""} aria-label={`Ver foto ${index + 1}`} />)}</div>
              </> : null}
            </> : <div className="hero-image-empty">Cargá fotos del local o equipo desde Administración → Home.</div>}
          </div>
        </div>
      </section>

      <section id="mas-vendidos" className="offers">
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
      </section>

      <section id="ofertas" className="offers">
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
      </section>

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
        {branchLocations.map((branch) => (
          <article className="location-card" key={branch.name}>
            <p className="eyebrow">Sucursal</p>
            <h2>{branch.name}</h2>
            <div className="location-contact">
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(branch.query)}`}
                target="_blank"
                rel="noreferrer"
                className="location-link"
              >
                {branch.city}
              </a>
              <a className="location-phone location-whatsapp" href={`https://wa.me/${branch.whatsapp}`} target="_blank" rel="noreferrer" aria-label={`Escribir por WhatsApp a ${branch.name}`}>
                <span aria-hidden="true">◉</span> WhatsApp: {branch.phone}
              </a>
            </div>
            <div className="location-map">
              <iframe
                title={branch.name}
                src={`https://www.google.com/maps?q=${encodeURIComponent(branch.query)}&output=embed`}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </article>
        ))}

        <article className="location-card">
          <p className="eyebrow">Servicio técnico</p>
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
