"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { normalizeImageUrl } from "@/lib/image-url";

type Product = {
  id: string;
  sku?: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  category: string;
  subCategory?: string;
  brand?: string;
  features?: string[];
  outlet: boolean;
  image: string;
  images?: string[];
};

type Order = {
  id: string;
  customerId: string;
  customer: { name: string; email: string; phone: string; address: string };
  items: { name: string; quantity: number; price: number }[];
  total: number;
  status: string;
  createdAt: string;
};

type HomepageSettings = {
  bestSellerIds: string[];
  offerIds: string[];
  offerTimers: { productId: string; endsAt: string }[];
  heroImages: string[];
  carouselSlides: { tag: string; title: string; text: string; image: string }[];
  bankPromotions: { title: string; description: string; note: string }[];
};

type Tab = "summary" | "home" | "orders" | "products" | "categories";
type FeaturedKey = "bestSellerIds" | "offerIds";

const pesos = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const statuses: Record<string, string> = {
  pending_review: "A revisar",
  approved: "Aprobado",
  paid: "Pagado",
  shipped: "Despachado",
  cancelled: "Cancelado"
};
const emptyProduct = { sku: "", name: "", description: "", price: "", stock: "", category: "", subCategory: "", brand: "", image: "📦", images: "", features: "", outlet: false };
const emptySlide = { tag: "", title: "", text: "", image: "" };
const emptyBankPromo = { title: "", description: "", note: "" };

export function AdminPanel() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [tab, setTab] = useState<Tab>("summary");
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [productForm, setProductForm] = useState(emptyProduct);
  const [editing, setEditing] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [homeSettings, setHomeSettings] = useState<HomepageSettings>({
    bestSellerIds: [],
    offerIds: [],
    offerTimers: [],
    heroImages: [],
    carouselSlides: [],
    bankPromotions: []
  });
  const [orderStatusFilter, setOrderStatusFilter] = useState("all");
  const [orderDateFrom, setOrderDateFrom] = useState("");
  const [orderDateTo, setOrderDateTo] = useState("");
  const [orderQuery, setOrderQuery] = useState("");
  const [pickerQueries, setPickerQueries] = useState<Record<FeaturedKey, string>>({ bestSellerIds: "", offerIds: "" });
  const [pickerResults, setPickerResults] = useState<Record<FeaturedKey, Product[]>>({ bestSellerIds: [], offerIds: [] });

  const load = async () => {
    const [orderData, productData, categoryData, homepageData] = await Promise.all([
      fetch("/api/orders").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/admin/products").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/admin/categories").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/admin/homepage").then((r) =>
        r.ok ? r.json() : { bestSellerIds: [], offerIds: [], offerTimers: [], heroImages: [], carouselSlides: [], bankPromotions: [] }
      )
    ]);
    setOrders(orderData);
    setProducts(productData);
    setCategories(categoryData);
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

  async function saveProduct(event: FormEvent) {
    event.preventDefault();
    const images = productForm.images
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean);
    const features = productForm.features
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean);
    const payload = {
      ...productForm,
      price: Number(productForm.price),
      stock: Number(productForm.stock),
      images: images.map((image) => normalizeImageUrl(image)),
      features,
      image: normalizeImageUrl(productForm.image)
    };
    const url = editing ? `/api/admin/products/${editing}` : "/api/admin/products";
    const response = await fetch(url, {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!response.ok) return setMessage("Revisá los datos del producto.");
    setMessage(editing ? "Producto actualizado." : "Producto creado.");
    setProductForm(emptyProduct);
    setEditing(null);
    void load();
  }

  async function deleteProduct(id: string) {
    if (!window.confirm("¿Eliminar este producto?")) return;
    await fetch(`/api/admin/products/${id}`, { method: "DELETE" });
    void load();
  }

  async function updateOrder(id: string, status: string) {
    const response = await fetch("/api/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status })
    });
    if (!response.ok) {
      setMessage("No se pudo actualizar el pedido.");
      return;
    }
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

  async function syncContabilium() {
    setMessage("Sincronizando con Contabilium…");
    const response = await fetch("/api/integrations/contabilium/sync", { method: "POST" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(payload.error ?? "No se pudo sincronizar con Contabilium.");
      return;
    }
    setMessage(`Contabilium sincronizado: ${payload.updated ?? 0} productos actualizados.`);
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
    const results = response.ok ? await response.json() : [];
    setPickerResults((current) => ({ ...current, [key]: results }));
  }

  const renderFeaturedPicker = (key: FeaturedKey) => {
    const selected = homeSettings[key];
    const selectedProducts = selected.map((id) => products.find((product) => product.id === id)).filter((product): product is Product => Boolean(product));
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

  const filteredOrders = useMemo(() => {
    const from = orderDateFrom ? new Date(orderDateFrom) : null;
    const to = orderDateTo ? new Date(`${orderDateTo}T23:59:59.999`) : null;
    const queryValue = orderQuery.trim().toLowerCase();

    return orders.filter((order) => {
      const orderDate = new Date(order.createdAt);
      const matchesStatus = orderStatusFilter === "all" || order.status === orderStatusFilter;
      const matchesFrom = !from || orderDate >= from;
      const matchesTo = !to || orderDate <= to;
      const searchable = [
        order.customer.name,
        order.customer.email,
        order.customer.phone,
        order.customer.address,
        order.items.map((item) => item.name).join(" ")
      ]
        .join(" ")
        .toLowerCase();
      const matchesQuery = !queryValue || searchable.includes(queryValue);
      return matchesStatus && matchesFrom && matchesTo && matchesQuery;
    });
  }, [orders, orderStatusFilter, orderDateFrom, orderDateTo, orderQuery]);

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

  const pending = orders.filter((order) => order.status === "pending_review").length;

  return (
    <main className="admin admin-layout">
      <aside className="admin-nav">
        <b>VENTAS</b>
        {(["summary", "home", "orders", "products", "categories"] as Tab[]).map((item) => (
          <button onClick={() => setTab(item)} className={tab === item ? "selected" : ""} key={item}>
            {({ summary: "Resumen", home: "Home", orders: "Pedidos", products: "Productos", categories: "Categorías" })[item]}
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
        {tab === "summary" && (
          <>
            <p>PANEL DE CONTROL</p>
            <h1>Resumen</h1>
            <div className="stats">
              <div>
                <span>Pedidos a revisar</span>
                <b>{pending}</b>
              </div>
              <div>
                <span>Productos activos</span>
                <b>{products.length}</b>
              </div>
              <div>
                <span>Venta registrada</span>
                <b>{pesos.format(orders.reduce((sum, order) => sum + order.total, 0))}</b>
              </div>
            </div>
          </>
        )}

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
                    const product = products.find((item) => item.id === productId);
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
                      <input value={slide.image} onChange={(event) => updateSlide(index, "image", event.target.value)} onBlur={(event) => updateSlide(index, "image", normalizeImageUrl(event.target.value, 1000))} placeholder="Enlace compartido de Google Drive" />
                      <small>Compartí el archivo en Drive como “Cualquiera con el enlace”. Para un mejor resultado, usá formato horizontal.</small>
                      <button type="button" onClick={() => removeSlide(index)}>Eliminar slide</button>
                    </article>
                  ))}
                </div>
              </section>

              <section>
                <h2>Fotos del local o equipo</h2>
                <p>Se muestran a la derecha del bloque principal en formato carrusel. Pegá hasta diez enlaces, uno por línea.</p>
                <textarea
                  value={homeSettings.heroImages.join("\n")}
                  onChange={(event) => setHomeSettings((current) => ({
                    ...current,
                    heroImages: event.target.value.split(/\r?\n/).map((image) => image.trim()).filter(Boolean).slice(0, 10)
                  }))}
                  placeholder="Enlaces de Google Drive o URLs públicas, una por línea"
                />
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

        {tab === "orders" && (
          <>
            <p>PEDIDOS</p>
            <h1>Pedidos recibidos</h1>
            <div className="order-filters">
              <input
                type="search"
                placeholder="Buscar por nombre, teléfono, mail o producto"
                value={orderQuery}
                onChange={(event) => setOrderQuery(event.target.value)}
              />
              <select value={orderStatusFilter} onChange={(event) => setOrderStatusFilter(event.target.value)}>
                <option value="all">Todos los estados</option>
                {Object.entries(statuses).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <input type="date" value={orderDateFrom} onChange={(event) => setOrderDateFrom(event.target.value)} />
              <input type="date" value={orderDateTo} onChange={(event) => setOrderDateTo(event.target.value)} />
            </div>
            <div className="orders">
              {filteredOrders.length === 0 ? (
                <div className="empty">No hay pedidos con esos filtros.</div>
              ) : (
                filteredOrders.map((order) => (
                  <article className="order" key={order.id}>
                    <div className="order-head">
                      <div>
                        <b>#{order.id.slice(-6).toUpperCase()}</b>
                        <span>
                          {new Date(order.createdAt).toLocaleDateString("es-AR")} · {order.customer.name}
                        </span>
                      </div>
                      <select value={order.status} onChange={(event) => updateOrder(order.id, event.target.value)}>
                        {Object.entries(statuses).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="order-grid">
                      <section>
                        <p>
                          {order.customer.email}
                          <br />
                          {order.customer.phone}
                          <br />
                          {order.customer.address}
                        </p>
                      </section>
                      <section>
                        {order.items.map((item, index) => (
                          <p key={index}>
                            {item.quantity}× {item.name} <b>{pesos.format(item.price * item.quantity)}</b>
                          </p>
                        ))}
                      </section>
                      <strong>{pesos.format(order.total)}</strong>
                    </div>
                  </article>
                ))
              )}
            </div>
          </>
        )}

        {tab === "products" && (
          <>
            <p>CATÁLOGO</p>
            <h1>{editing ? "Editar producto" : "Productos"}</h1>
            <button type="button" onClick={syncContabilium}>Sincronizar con Contabilium</button>
            <form className="product-form" onSubmit={saveProduct}>
              <input value={productForm.sku} onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })} placeholder="SKU Contabilium" />
              <input value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} placeholder="Nombre" required />
              <input value={productForm.category} onChange={(e) => setProductForm({ ...productForm, category: e.target.value })} placeholder="Categoría" list="categories" required />
              <input value={productForm.subCategory} onChange={(e) => setProductForm({ ...productForm, subCategory: e.target.value })} placeholder="Subcategoría" />
              <input value={productForm.brand} onChange={(e) => setProductForm({ ...productForm, brand: e.target.value })} placeholder="Marca" />
              <datalist id="categories">
                {categories.map((category) => <option key={category} value={category} />)}
              </datalist>
              <input value={productForm.price} onChange={(e) => setProductForm({ ...productForm, price: e.target.value.replace(/\D/g, "") })} placeholder="Precio" inputMode="numeric" required />
              <input value={productForm.stock} onChange={(e) => setProductForm({ ...productForm, stock: e.target.value.replace(/\D/g, "") })} placeholder="Stock" inputMode="numeric" required />
              <input value={productForm.image} onChange={(e) => setProductForm({ ...productForm, image: e.target.value })} placeholder="Emoji / referencia visual" required />
              <textarea
                value={productForm.images}
                onChange={(e) => setProductForm({ ...productForm, images: e.target.value })}
                placeholder="Galería de imágenes: una URL por línea (la primera será la portada)"
              />
              <textarea
                value={productForm.features}
                onChange={(e) => setProductForm({ ...productForm, features: e.target.value })}
                placeholder={'Características de la tarjeta, una por línea. Ej.: 55″ · 4K · No Frost · 340 L'}
                maxLength={400}
              />
              <textarea value={productForm.description} onChange={(e) => setProductForm({ ...productForm, description: e.target.value })} placeholder="Descripción" required />
              <label>
                <input type="checkbox" checked={productForm.outlet} onChange={(e) => setProductForm({ ...productForm, outlet: e.target.checked })} /> Producto outlet
              </label>
              <button>{editing ? "Guardar cambios" : "Crear producto"}</button>
              {editing && (
                <button type="button" onClick={() => { setEditing(null); setProductForm(emptyProduct); }}>
                  Cancelar
                </button>
              )}
              <small>{message}</small>
            </form>
            <div className="product-admin-list">
              {products.map((product) => (
                <article key={product.id}>
                  <span>{product.image}</span>
                  <div>
                    <b>{product.name}</b>
                    <small>{product.sku ? `${product.sku} · ` : ""}{product.category} · {product.stock} unidades</small>
                  </div>
                  <strong>{pesos.format(product.price)}</strong>
                  <button
                    onClick={() => {
                      setEditing(product.id);
                      setProductForm({
                        sku: product.sku ?? "",
                        name: product.name,
                        description: product.description,
                        price: String(product.price),
                        stock: String(product.stock),
                        category: product.category,
                        subCategory: product.subCategory ?? "",
                        brand: product.brand ?? "",
                        image: product.image,
                        images: (product.images ?? []).join("\n"),
                        features: (product.features ?? []).join("\n"),
                        outlet: product.outlet
                      });
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                  >
                    Editar
                  </button>
                  <button onClick={() => deleteProduct(product.id)}>Eliminar</button>
                </article>
              ))}
            </div>
          </>
        )}

        {tab === "categories" && (
          <>
            <p>ORGANIZACIÓN</p>
            <h1>Categorías</h1>
            <form className="category-form" onSubmit={addCategory}>
              <input name="category" placeholder="Nueva categoría" required />
              <button>Agregar</button>
            </form>
            <div className="category-list">
              {categories.map((category) => <span key={category}>{category}</span>)}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
