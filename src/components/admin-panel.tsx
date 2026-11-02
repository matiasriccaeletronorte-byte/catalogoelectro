"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { shrinkImage } from "@/lib/client-image";
import { normalizeImageUrl } from "@/lib/image-url";
import type { Product } from "@/lib/types";
import { ProductsTab } from "./admin/products-tab";
import { ImportTab } from "./admin/import-tab";
import { SettingsTab } from "./admin/settings-tab";


type HomepageSettings = {
  bestSellerIds: string[];
  offerIds: string[];
  offerTimers: { productId: string; endsAt: string }[];
  heroImages: string[];
  carouselSlides: { tag: string; title: string; text: string; image: string }[];
  bankPromotions: { title: string; description: string; note: string }[];
};

type Tab = "products" | "import" | "settings" | "home" | "categories";
type FeaturedKey = "bestSellerIds" | "offerIds";

const emptySlide = { tag: "", title: "", text: "", image: "" };
const emptyBankPromo = { title: "", description: "", note: "" };

export function AdminPanel() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [tab, setTab] = useState<Tab>("products");
  const [categories, setCategories] = useState<string[]>([]);
  const [subTree, setSubTree] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState("");
  const [homeSettings, setHomeSettings] = useState<HomepageSettings>({
    bestSellerIds: [],
    offerIds: [],
    offerTimers: [],
    heroImages: [],
    carouselSlides: [],
    bankPromotions: []
  });
  const [pickerQueries, setPickerQueries] = useState<Record<FeaturedKey, string>>({ bestSellerIds: "", offerIds: "" });
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [pickerResults, setPickerResults] = useState<Record<FeaturedKey, Product[]>>({ bestSellerIds: [], offerIds: [] });

  const load = async () => {
    const [categoryData, subData, homepageData] = await Promise.all([
      fetch("/api/admin/categories").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/admin/subcategories").then((r) => (r.ok ? r.json() : {})),
      fetch("/api/admin/homepage").then((r) =>
        r.ok ? r.json() : { bestSellerIds: [], offerIds: [], offerTimers: [], heroImages: [], carouselSlides: [], bankPromotions: [] }
      )
    ]);
    setCategories(categoryData);
    setSubTree(subData);
    setHomeSettings({
      bestSellerIds: (homepageData.bestSellerIds ?? []).slice(0, 3),
      offerIds: (homepageData.offerIds ?? []).slice(0, 3),
      offerTimers: (homepageData.offerTimers ?? []).filter((timer: { productId: string }) => (homepageData.offerIds ?? []).slice(0, 3).includes(timer.productId)).slice(0, 3),
      heroImages: homepageData.heroImages ?? [],
      carouselSlides: (homepageData.carouselSlides ?? []).map((slide: typeof emptySlide) => ({
        ...slide,
        image: slide.image ?? ""
      })),
      bankPromotions: homepageData.bankPromotions ?? []
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

  async function addCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const name = new FormData(form).get("category");
    if (typeof name !== "string" || !name.trim()) return;
    const response = await fetch("/api/admin/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() })
    });
    if (!response.ok) return;
    form.reset();
    void load();
  }

  async function addSubCategory(category: string, form: HTMLFormElement) {
    const name = String(new FormData(form).get("sub") ?? "").trim();
    if (name.length < 2) return;
    const response = await fetch("/api/admin/subcategories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ category, name }) });
    if (!response.ok) return setMessage("No se pudo crear la subcategoría.");
    form.reset();
    void load();
  }

  async function removeSubCategory(category: string, name: string) {
    const response = await fetch("/api/admin/subcategories", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ category, name }) });
    if (!response.ok) return setMessage((await response.json().catch(() => ({}))).error ?? "No se pudo quitar la subcategoría.");
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

  const uploadSlideImage = async (index: number, file: File | undefined) => {
    if (!file) return;
    const body = new FormData();
    body.set("file", await shrinkImage(file, 2400));
    const response = await fetch("/api/admin/banner-image", { method: "POST", body });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return setMessage(result.error ?? "No se pudo subir la imagen.");
    updateSlide(index, "image", result.url);
    setMessage("Imagen subida. Guardá los cambios para publicarla.");
  };

  const updateBankPromo = (index: number, field: keyof typeof emptyBankPromo, value: string) => {
    setHomeSettings((current) => {
      const bankPromotions = [...current.bankPromotions];
      bankPromotions[index] = { ...(bankPromotions[index] ?? emptyBankPromo), [field]: value };
      return { ...current, bankPromotions };
    });
  };

  const addSlide = () => setHomeSettings((current) => ({ ...current, carouselSlides: [...current.carouselSlides, emptySlide] }));
  const removeSlide = (index: number) =>
    setHomeSettings((current) => ({ ...current, carouselSlides: current.carouselSlides.filter((_, itemIndex) => itemIndex !== index) }));
  const addBankPromo = () => setHomeSettings((current) => ({ ...current, bankPromotions: [...current.bankPromotions, emptyBankPromo] }));
  const removeBankPromo = (index: number) =>
    setHomeSettings((current) => ({ ...current, bankPromotions: current.bankPromotions.filter((_, itemIndex) => itemIndex !== index) }));

  async function saveHomepageSettings() {
    const carouselSlides = homeSettings.carouselSlides.map((slide) => ({ ...slide, image: normalizeImageUrl(slide.image, 1000) }));
    const heroImages = homeSettings.heroImages.map((image) => normalizeImageUrl(image)).filter(Boolean);
    const bestSellerIds = homeSettings.bestSellerIds.slice(0, 3);
    const offerIds = homeSettings.offerIds.slice(0, 3);
    const offerTimers = homeSettings.offerTimers.filter((timer) => offerIds.includes(timer.productId)).slice(0, 3);
    const response = await fetch("/api/admin/homepage", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...homeSettings, bestSellerIds, offerIds, offerTimers, carouselSlides, heroImages })
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
        {(["products", "import", "settings", "home", "categories"] as Tab[]).map((item) => (
          <button onClick={() => setTab(item)} className={tab === item ? "selected" : ""} key={item}>
            {({ products: "Productos", import: "Importar / Exportar", settings: "WhatsApp y promos", home: "Home", categories: "Categorías" })[item]}
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
                      <div className="slide-image-field">
                        {slide.image ? <img src={slide.image} alt="Imagen del slide" /> : <span>Sin imagen</span>}
                        <label className="slide-image-upload">
                          {slide.image ? "Cambiar imagen" : "Subir imagen"}
                          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { void uploadSlideImage(index, event.target.files?.[0]); event.target.value = ""; }} />
                        </label>
                        {slide.image ? <button type="button" onClick={() => updateSlide(index, "image", "")}>Quitar imagen</button> : null}
                      </div>
                      <small>La imagen se sube a la tienda (JPG, PNG o WebP, hasta 4 MB). Mejor en formato horizontal, por ejemplo 1920 × 720.</small>
                      <button type="button" onClick={() => removeSlide(index)}>Eliminar slide</button>
                    </article>
                  ))}
                </div>
              </section>

              <section>
                <h2>Promos bancarias</h2>
                <p>Contenido libre, independiente de los productos.</p>
                <div className="home-editor-actions">
                  <button type="button" onClick={addBankPromo}>Agregar promo</button>
                </div>
                <div className="home-editor-stack">
                  {homeSettings.bankPromotions.map((promo, index) => (
                    <article key={`promo-${index}`} className="home-editor-item">
                      <input value={promo.title} onChange={(event) => updateBankPromo(index, "title", event.target.value)} placeholder="Título" />
                      <textarea value={promo.description} onChange={(event) => updateBankPromo(index, "description", event.target.value)} placeholder="Descripción" />
                      <input value={promo.note} onChange={(event) => updateBankPromo(index, "note", event.target.value)} placeholder="Nota corta" />
                      <button type="button" onClick={() => removeBankPromo(index)}>Eliminar promo</button>
                    </article>
                  ))}
                </div>
              </section>
            </div>
            <button type="button" onClick={saveHomepageSettings}>Guardar home</button>
            <small>{message}</small>
          </>
        )}

        {tab === "products" && <ProductsTab categories={categories} subCategories={subTree} />}
        {tab === "import" && <ImportTab />}
        {tab === "settings" && <SettingsTab />}

        {tab === "categories" && (
          <>
            <p>ORGANIZACIÓN</p>
            <h1>Categorías</h1>
            <form className="category-form" onSubmit={addCategory}>
              <input name="category" placeholder="Nueva categoría" required />
              <button>Agregar</button>
            </form>
            <small>Creá la categoría y después sumale sus subcategorías. Al cargar un artículo las elegís de la lista.</small>
            <div className="category-tree">
              {categories.map((category) => <section key={category} className="category-node">
                <h3>{category}</h3>
                <div className="category-list">
                  {(subTree[category] ?? []).map((sub) => <span key={sub}>{sub} <button type="button" aria-label={`Quitar ${sub}`} onClick={() => void removeSubCategory(category, sub)}>✕</button></span>)}
                  {(subTree[category] ?? []).length === 0 ? <small>Sin subcategorías</small> : null}
                </div>
                <form className="category-form" onSubmit={(event) => { event.preventDefault(); void addSubCategory(category, event.currentTarget); }}>
                  <input name="sub" placeholder={`Nueva subcategoría de ${category}`} />
                  <button>Agregar</button>
                </form>
              </section>)}
            </div>
            <small>{message}</small>
          </>
        )}
      </section>
    </main>
  );
}
