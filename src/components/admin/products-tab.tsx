"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { normalizeImageUrl } from "@/lib/image-url";
import type { Product } from "@/lib/types";

const pesos = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const emptyForm = { sku: "", name: "", description: "", category: "", subCategory: "", brand: "", cashPrice: "", listPrice: "", available: true, outlet: false, active: true, features: "" };
type AdminProduct = Product & { active: boolean };
type Page = { items: AdminProduct[]; total: number; page: number; pageSize: number };

export function ProductsTab({ categories }: { categories: string[] }) {
  const [data, setData] = useState<Page>({ items: [], total: 0, page: 1, pageSize: 25 });
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<string | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page) });
    if (query.trim()) params.set("q", query.trim());
    const response = await fetch(`/api/admin/products?${params}`);
    if (response.ok) setData(await response.json());
  }, [page, query]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(timer);
  }, [load]);

  function edit(product: AdminProduct) {
    setEditing(product.id);
    setImages(product.images ?? []);
    setForm({
      sku: product.sku ?? "", name: product.name, description: product.description, category: product.category,
      subCategory: product.subCategory ?? "", brand: product.brand ?? "", cashPrice: String(product.cashPrice), listPrice: String(product.listPrice),
      available: product.available, outlet: product.outlet, active: product.active, features: (product.features ?? []).join("\n")
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function reset() {
    setEditing(null); setImages([]); setForm(emptyForm);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    const payload = {
      ...form,
      cashPrice: Number(form.cashPrice),
      listPrice: Number(form.listPrice),
      features: form.features.split(/\r?\n/).map((f) => f.trim()).filter(Boolean)
    };
    const response = await fetch(editing ? `/api/admin/products/${editing}` : "/api/admin/products", {
      method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return setMessage(body.error ?? "Revisá los datos del producto.");
    setMessage(editing ? "Producto actualizado." : "Producto creado. Ahora podés cargarle imágenes.");
    if (!editing) { setEditing(body.id); }
    void load();
  }

  async function deactivate(id: string) {
    if (!window.confirm("¿Desactivar este producto? Dejará de verse en el catálogo.")) return;
    await fetch(`/api/admin/products/${id}`, { method: "DELETE" });
    if (editing === id) reset();
    void load();
  }

  async function upload(file: File | undefined) {
    if (!file || !editing) return;
    const body = new FormData();
    body.set("file", file);
    const response = await fetch(`/api/admin/products/${editing}/images`, { method: "POST", body });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return setMessage(result.error ?? "No se pudo subir la imagen.");
    setImages(result.images);
    void load();
  }

  async function removeImage(url: string) {
    if (!editing) return;
    const response = await fetch(`/api/admin/products/${editing}/images?url=${encodeURIComponent(url)}`, { method: "DELETE" });
    if (response.ok) { setImages((await response.json()).images); void load(); }
  }

  const set = (key: keyof typeof emptyForm, value: string | boolean) => setForm({ ...form, [key]: value });
  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));

  return <>
    <p>CATÁLOGO</p>
    <h1>{editing ? "Editar producto" : "Productos"}</h1>
    <form className="product-form" onSubmit={save}>
      <input value={form.sku} onChange={(e) => set("sku", e.target.value)} placeholder="SKU (código único)" required />
      <input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Nombre" required />
      <input value={form.category} onChange={(e) => set("category", e.target.value)} placeholder="Categoría" list="categories" required />
      <input value={form.subCategory} onChange={(e) => set("subCategory", e.target.value)} placeholder="Subcategoría" />
      <input value={form.brand} onChange={(e) => set("brand", e.target.value)} placeholder="Marca" />
      <datalist id="categories">{categories.map((c) => <option key={c} value={c} />)}</datalist>
      <input value={form.cashPrice} onChange={(e) => set("cashPrice", e.target.value.replace(/\D/g, ""))} placeholder="Precio en efectivo" inputMode="numeric" required />
      <input value={form.listPrice} onChange={(e) => set("listPrice", e.target.value.replace(/\D/g, ""))} placeholder="Precio de contado" inputMode="numeric" required />
      <textarea value={form.features} onChange={(e) => set("features", e.target.value)} placeholder="Características, una por línea. Ej.: No Frost · 340 L" maxLength={400} />
      <textarea value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Descripción" />
      <label><input type="checkbox" checked={form.available} onChange={(e) => set("available", e.target.checked)} /> Disponible</label>
      <label><input type="checkbox" checked={form.active} onChange={(e) => set("active", e.target.checked)} /> Visible en el catálogo (activo)</label>
      <label><input type="checkbox" checked={form.outlet} onChange={(e) => set("outlet", e.target.checked)} /> Producto outlet</label>
      {editing ? <div className="image-manager">
        <b>Imágenes</b>
        <div className="image-manager-list">
          {images.map((url) => <span key={url}><img src={normalizeImageUrl(url, 160)} alt="" width={64} height={64} /><button type="button" onClick={() => void removeImage(url)} aria-label="Quitar imagen">×</button></span>)}
        </div>
        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ""; }} />
      </div> : <small>Guardá el producto para poder cargarle imágenes.</small>}
      <button>{editing ? "Guardar cambios" : "Crear producto"}</button>
      {editing ? <button type="button" onClick={reset}>Cancelar</button> : null}
      <small>{message}</small>
    </form>

    <input className="admin-search" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder="Buscar por nombre, marca o SKU" />
    <div className="product-admin-list">
      {data.items.map((product) => (
        <article key={product.id}>
          <span>{product.image ? <img src={normalizeImageUrl(product.image, 120)} alt="" width={40} height={40} /> : "📦"}</span>
          <div><b>{product.name}</b><small>{product.sku} · {product.category}{product.available ? "" : " · no disponible"}{product.active ? "" : " · INACTIVO"}</small></div>
          <strong>{pesos.format(product.cashPrice)} / {pesos.format(product.listPrice)}</strong>
          <button onClick={() => edit(product)}>Editar</button>
          {product.active ? <button onClick={() => void deactivate(product.id)}>Desactivar</button> : <button onClick={() => edit(product)}>Reactivar</button>}
        </article>
      ))}
      {data.items.length === 0 ? <small>No hay productos para mostrar.</small> : null}
    </div>
    <div className="catalog-pagination">
      <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</button>
      <span>Página {page} de {totalPages} · {data.total} productos</span>
      <button type="button" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Siguiente</button>
    </div>
  </>;
}
