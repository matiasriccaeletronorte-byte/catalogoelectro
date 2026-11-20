"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { shrinkImage } from "@/lib/client-image";
import { normalizeImageUrl } from "@/lib/image-url";
import type { Product } from "@/lib/types";
import { BankPromosTab } from "@/components/admin/bank-promos-tab";
import { CouponsTab } from "@/components/admin/coupons-tab";
import { BrandsTab, type BrandRow } from "@/components/admin/brands-tab";
import { ProductsTab } from "./admin/products-tab";
import { CategoriesTab } from "./admin/categories-tab";
import type { CategoryNodeData } from "@/lib/category-tree";
import { ImportTab } from "./admin/import-tab";
import { SettingsTab } from "./admin/settings-tab";


type HomepageSettings = {
  bestSellerIds: string[];
  offerIds: string[];
  offerTimers: { productId: string; endsAt: string }[];
  heroImages: string[];
  carouselSlides: { tag: string; title: string; text: string; image: string; mobileImage: string }[];
};

type Tab = "products" | "import" | "settings" | "home" | "categories" | "brands" | "coupons" | "bank";
type FeaturedKey = "bestSellerIds" | "offerIds";

const emptySlide = { tag: "", title: "", text: "", image: "", mobileImage: "" };

export function AdminPanel() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [tab, setTab] = useState<Tab>("products");
  const [nodes, setNodes] = useState<CategoryNodeData[]>([]);
  const [brands, setBrands] = useState<BrandRow[]>([]);
  const [message, setMessage] = useState("");
  const [homeSettings, setHomeSettings] = useState<HomepageSettings>({
    bestSellerIds: [],
    offerIds: [],
    offerTimers: [],
    heroImages: [],
    carouselSlides: [],
  });
  const [pickerQueries, setPickerQueries] = useState<Record<FeaturedKey, string>>({ bestSellerIds: "", offerIds: "" });
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [pickerResults, setPickerResults] = useState<Record<FeaturedKey, Product[]>>({ bestSellerIds: [], offerIds: [] });

  const load = async () => {
    const [treeData, brandData, homepageData] = await Promise.all([
      fetch("/api/admin/category-tree").then((r) => (r.ok ? r.json() : { nodes: [] })),
      fetch("/api/admin/brands").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/admin/homepage").then((r) =>
        r.ok ? r.json() : { bestSellerIds: [], offerIds: [], offerTimers: [], heroImages: [], carouselSlides: [] }
      )
    ]);
    setNodes(treeData.nodes ?? []);
    setBrands(brandData);
    setHomeSettings({
      bestSellerIds: (homepageData.bestSellerIds ?? []).slice(0, 3),
      offerIds: (homepageData.offerIds ?? []).slice(0, 3),
      offerTimers: (homepageData.offerTimers ?? []).filter((timer: { productId: string }) => (homepageData.offerIds ?? []).slice(0, 3).includes(timer.productId)).slice(0, 3),
      heroImages: homepageData.heroImages ?? [],
      carouselSlides: (homepageData.carouselSlides ?? []).map((slide: typeof emptySlide) => ({
        ...slide,
        image: slide.image ?? "",
        mobileImage: slide.mobileImage ?? ""
      })),
    });
    const featuredIds = [...new Set([...(homepageData.bestSellerIds ?? []), ...(homepageData.offerIds ?? [])])];
    if (featuredIds.length) setFeaturedProducts((await fetch(`/api/products?ids=${featuredIds.join(",")}`).then((r) => (r.ok ? r.json() : { items: [] }))).items ?? []);
  };

  useEffect(() => {
    fetch("/api/admin/session")
      .then((r) => r.json())
      .then((data) => {
        setAuthenticated(data.authenticated);
        if (data.authenticated) void load();
      });
  }, []);

  // cierre por inactividad: 30 min sin tocar nada. Mientras se trabaja, un aviso cada 5 min mantiene viva la sesión.
  useEffect(() => {
    if (!authenticated) return;
    const IDLE_MS = 30 * 60 * 1000;
    const PING_MS = 5 * 60 * 1000;
    let lastActivity = Date.now();
    let lastPing = Date.now();
    const touch = () => { lastActivity = Date.now(); };
    const expire = (reason: string) => {
      void fetch("/api/admin/session", { method: "DELETE" }).catch(() => undefined);
      setAuthenticated(false);
      setPassword("");
      setLoginError(reason);
    };
    const ping = () => {
      lastPing = Date.now();
      fetch("/api/admin/session").then((r) => r.json()).then((data) => { if (!data.authenticated) expire("Tu sesión venció. Volvé a ingresar."); }).catch(() => undefined);
    };
    const check = () => {
      const now = Date.now();
      if (now - lastActivity >= IDLE_MS) return expire("Tu sesión se cerró por inactividad. Volvé a ingresar.");
      if (now - lastPing >= PING_MS && now - lastActivity < PING_MS) ping();
    };
    const onVisible = () => { if (document.visibilityState === "visible") check(); };
    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"] as const;
    events.forEach((name) => window.addEventListener(name, touch, { passive: true }));
    document.addEventListener("visibilitychange", onVisible);
    const timer = setInterval(check, 15_000);
    return () => {
      clearInterval(timer);
      events.forEach((name) => window.removeEventListener(name, touch));
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [authenticated]);

  async function login(event: FormEvent) {
    event.preventDefault();
    setLoginError("");
    const response = await fetch("/api/admin/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password })
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      return setLoginError(payload.error ?? "Contraseña incorrecta o panel sin configurar.");
    }
    setAuthenticated(true);
    void load();
  }

  const updateSelected = (key: keyof Pick<HomepageSettings, "bestSellerIds" | "offerIds">, values: string[]) => {
    const selected = values.slice(0, 3);
    if (values.length > 3) setMessage("Podés seleccionar hasta 3 productos por sección.");
    setHomeSettings((current) => ({
      ...current,
      [key]: selected,
      offerTimers: key === "offerIds" ? current.offerTimers.filter((timer) => selected.includes(timer.productId)) : current.offerTimers
    }));
  };

  const toggleSelected = (key: keyof Pick<HomepageSettings, "bestSellerIds" | "offerIds">, productId: string) => {
    const current = homeSettings[key];
    updateSelected(key, current.includes(productId) ? current.filter((id) => id !== productId) : [...current, productId]);
  };

  async function searchFeaturedProducts(key: FeaturedKey, value: string) {
    setPickerQueries((current) => ({ ...current, [key]: value }));
    if (value.trim().length < 2) {
      setPickerResults((current) => ({ ...current, [key]: [] }));
      return;
    }
    const response = await fetch(`/api/admin/products?q=${encodeURIComponent(value.trim())}&limit=8`);
    const results = response.ok ? (await response.json()).items : [];
    setPickerResults((current) => ({ ...current, [key]: results }));
  }

  const renderFeaturedPicker = (key: FeaturedKey) => {
    const selected = homeSettings[key];
    const selectedProducts = selected.map((id) => [...featuredProducts, ...pickerResults.bestSellerIds, ...pickerResults.offerIds].find((product) => product.id === id)).filter((product): product is Product => Boolean(product));
    return <div className="featured-product-search">
      <input value={pickerQueries[key]} onChange={(event) => void searchFeaturedProducts(key, event.target.value)} placeholder="Escribí nombre, marca o SKU para buscar" />
      {pickerQueries[key].trim().length >= 2 ? <div className="featured-product-results">{pickerResults[key].length === 0 ? <span>Sin resultados.</span> : pickerResults[key].map((product) => <button type="button" key={product.id} disabled={selected.includes(product.id) || selected.length >= 3} onClick={() => toggleSelected(key, product.id)}><b>{product.name}</b><small>{product.sku || product.brand || product.category}</small></button>)}</div> : null}
      <div className="featured-product-selected">{selectedProducts.length === 0 ? <small>Seleccioná hasta 3 productos.</small> : selectedProducts.map((product) => <span key={product.id}>{product.name}<button type="button" onClick={() => toggleSelected(key, product.id)} aria-label={`Quitar ${product.name}`}>×</button></span>)}</div>
    </div>;
  };

  const updateOfferTimer = (productId: string, endsAt: string) => {
    setHomeSettings((current) => {
      const previous = current.offerTimers.filter((timer) => timer.productId !== productId);
      return { ...current, offerTimers: endsAt ? [...previous, { productId, endsAt }] : previous };
    });
  };

  const updateSlide = (index: number, field: keyof typeof emptySlide, value: string) => {
    setHomeSettings((current) => {
      const carouselSlides = [...current.carouselSlides];
      carouselSlides[index] = { ...(carouselSlides[index] ?? emptySlide), [field]: value };
      return { ...current, carouselSlides };
    });
  };

  const uploadSlideImage = async (index: number, file: File | undefined, field: "image" | "mobileImage" = "image") => {
    if (!file) return;
    const body = new FormData();
    body.set("file", await shrinkImage(file, field === "image" ? 2400 : 1000));
    const response = await fetch("/api/admin/banner-image", { method: "POST", body });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return setMessage(result.error ?? "No se pudo subir la imagen.");
    updateSlide(index, field, result.url);
    setMessage("Imagen subida. Guardá los cambios para publicarla.");
  };

  const addSlide = () => setHomeSettings((current) => ({ ...current, carouselSlides: [...current.carouselSlides, emptySlide] }));
  const removeSlide = (index: number) =>
    setHomeSettings((current) => ({ ...current, carouselSlides: current.carouselSlides.filter((_, itemIndex) => itemIndex !== index) }));

  async function saveHomepageSettings() {
    const carouselSlides = homeSettings.carouselSlides.map((slide) => ({ ...slide, image: normalizeImageUrl(slide.image, 1000), mobileImage: normalizeImageUrl(slide.mobileImage, 800) }));
    const heroImages = homeSettings.heroImages.map((image) => normalizeImageUrl(image)).filter(Boolean);
    const bestSellerIds = homeSettings.bestSellerIds.slice(0, 3);
    const offerIds = homeSettings.offerIds.slice(0, 3);
    const offerTimers = homeSettings.offerTimers.filter((timer) => offerIds.includes(timer.productId)).slice(0, 3);
    const response = await fetch("/api/admin/homepage", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bestSellerIds, offerIds, offerTimers, carouselSlides, heroImages })
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setMessage(payload.error ?? "No se pudo guardar el home.");
      return;
    }
    setHomeSettings((current) => ({ ...current, bestSellerIds, offerIds, offerTimers, carouselSlides, heroImages }));
    setMessage("Home actualizado.");
  }

  if (authenticated === null) return <main className="admin">Cargando panel…</main>;

  if (!authenticated) {
    return (
      <main className="admin login">
        <p>PANEL PRIVADO</p>
        <h1>Administración</h1>
        <form onSubmit={login}>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Contraseña de vendedor"
            required
          />
          <button>Ingresar</button>
          <small>{loginError}</small>
        </form>
      </main>
    );
  }

  return (
    <main className="admin admin-layout">
      <aside className="admin-nav">
        <b>VENTAS</b>
        {(["products", "import", "settings", "home", "categories", "brands", "coupons", "bank"] as Tab[]).map((item) => (
          <button onClick={() => setTab(item)} className={tab === item ? "selected" : ""} key={item}>
            {({ products: "Productos", import: "Importar / Exportar", settings: "WhatsApp", home: "Home", categories: "Categorías", brands: "Marcas", coupons: "Cupones", bank: "Promos bancarias" })[item]}
          </button>
        ))}
        <button
          className="signout"
          onClick={async () => {
            await fetch("/api/admin/session", { method: "DELETE" });
            setAuthenticated(false);
          }}
        >
          Cerrar sesión
        </button>
      </aside>
      <section className="admin-content">
        {tab === "home" && (
          <>
            <p>HOME</p>
            <h1>Secciones administrables</h1>
            <div className="home-editor">
              <section>
                <h2>Más vendidos</h2>
                <p>Elegí más de un producto para la sección de más vendidos.</p>
                {renderFeaturedPicker("bestSellerIds")}
              </section>

              <section>
                <h2>Ofertas</h2>
                <p>Seleccioná los productos que querés mostrar en ofertas.</p>
                {renderFeaturedPicker("offerIds")}
                <label className="offer-timer-field">
                  <span>Temporizadores por oferta</span>
                  {homeSettings.offerIds.length === 0 ? <small>Primero seleccioná hasta tres productos de oferta.</small> : homeSettings.offerIds.map((productId) => {
                    const product = featuredProducts.find((item) => item.id === productId);
                    const timer = homeSettings.offerTimers.find((item) => item.productId === productId);
                    return <label key={productId} className="offer-timer-row"><span>{product?.name ?? "Producto"}</span><input type="datetime-local" value={timer?.endsAt ?? ""} onChange={(event) => updateOfferTimer(productId, event.target.value)} /></label>;
                  })}
                  <small>Dejá una fecha vacía para no mostrar temporizador en ese artículo.</small>
                </label>
              </section>

              <section>
                <h2>Carrusel</h2>
                <p>Editá los textos del banner principal de la home.</p>
                <div className="home-editor-actions">
                  <button type="button" onClick={addSlide}>Agregar slide</button>
                </div>
                <div className="home-editor-stack">
                  {homeSettings.carouselSlides.map((slide, index) => (
                    <article key={`slide-${index}`} className="home-editor-item">
                      <input value={slide.tag} onChange={(event) => updateSlide(index, "tag", event.target.value)} placeholder="Etiqueta" />
                      <input value={slide.title} onChange={(event) => updateSlide(index, "title", event.target.value)} placeholder="Título" />
                      <textarea value={slide.text} onChange={(event) => updateSlide(index, "text", event.target.value)} placeholder="Texto" />
                      {([["image", "Escritorio", "2400 × 600 px"], ["mobileImage", "Celular", "800 × 410 px"]] as const).map(([field, label, size]) => (
                        <div className="slide-image-field" key={field}>
                          {slide[field] ? <img src={slide[field]} alt={`Imagen para ${label.toLowerCase()}`} /> : <span>Sin imagen</span>}
                          <label className="slide-image-upload">
                            {slide[field] ? `Cambiar imagen de ${label.toLowerCase()}` : `Subir imagen de ${label.toLowerCase()}`} ({size})
                            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { void uploadSlideImage(index, event.target.files?.[0], field); event.target.value = ""; }} />
                          </label>
                          {slide[field] ? <button type="button" onClick={() => updateSlide(index, field, "")}>Quitar</button> : null}
                        </div>
                      ))}
                      <button type="button" onClick={() => removeSlide(index)}>Eliminar slide</button>
                    </article>
                  ))}
                </div>
              </section>

            </div>
            <button type="button" onClick={saveHomepageSettings}>Guardar home</button>
            <small>{message}</small>
          </>
        )}

        {tab === "products" && <ProductsTab nodes={nodes} brands={brands.map((b) => b.name)} />}
        {tab === "import" && <ImportTab />}
        {tab === "settings" && <SettingsTab />}

        {tab === "coupons" && <CouponsTab />}
        {tab === "bank" && <BankPromosTab />}

        {tab === "brands" && <BrandsTab brands={brands} onChange={() => void load()} />}

        {tab === "categories" && <CategoriesTab onChange={() => void load()} />}
      </section>
    </main>
  );
}
