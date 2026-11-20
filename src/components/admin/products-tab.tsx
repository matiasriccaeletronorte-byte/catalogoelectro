"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { shrinkImage } from "@/lib/client-image";
import { MAX_IMAGES_PER_PRODUCT, planUploads } from "@/lib/image-limits";
import { cashFromDiscount, DiscountType, impliedDiscount } from "@/lib/cash-discount";
import { normalizeImageUrl } from "@/lib/image-url";
import { ImagePlaceholder } from "../image-placeholder";
import { CategoryPicker } from "./category-picker";
import { formatPath, nodePath, type CategoryNodeData } from "@/lib/category-tree";
import type { Product } from "@/lib/types";

const pesos = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const emptyForm = { sku: "", name: "", description: "", categoryId: "", brand: "", cashPrice: "", listPrice: "", available: true, outlet: false, active: true, features: "" };
type AdminProduct = Product & { active: boolean };
type Page = { items: AdminProduct[]; total: number; page: number; pageSize: number };

export function ProductsTab({ nodes = [], brands = [] }: { nodes?: CategoryNodeData[]; brands?: string[] }) {
  const [data, setData] = useState<Page>({ items: [], total: 0, page: 1, pageSize: 25 });
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<string | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [discountType, setDiscountType] = useState<DiscountType>("percent");
  const [discountValue, setDiscountValue] = useState("");
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
    setDiscountValue("");
    setImages(product.images ?? []);
    setForm({
      sku: product.sku ?? "", name: product.name, description: product.description,
      categoryId: product.categoryId ?? "", brand: product.brand ?? "", cashPrice: String(product.cashPrice), listPrice: String(product.listPrice),
      available: product.available, outlet: product.outlet, active: product.active, features: (product.features ?? []).join("\n")
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function reset() {
    setEditing(null); setImages([]); setForm(emptyForm); setDiscountValue("");
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

  // Varias imágenes juntas: se suben de a una (en orden) para que el servidor no pise la lista de fotos del artículo.
  async function uploadMany(selected: File[]) {
    if (!editing || uploading || selected.length === 0) return;
    const plan = planUploads(selected, images.length);
    const problems: string[] = [];
    if (plan.wrongType.length) problems.push(`${plan.wrongType.length} no son JPG, PNG ni WebP`);
    if (plan.overLimit) problems.push(`${plan.overLimit} no entraron (máximo ${MAX_IMAGES_PER_PRODUCT} por artículo)`);
    let ok = 0;
    setMessage("");
    for (let index = 0; index < plan.accepted.length; index++) {
      setUploading({ done: index, total: plan.accepted.length });
      const file = plan.accepted[index];
      try {
        const body = new FormData();
        body.set("file", await shrinkImage(file));
        const response = await fetch(`/api/admin/products/${editing}/images`, { method: "POST", body });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) { problems.push(`${file.name}: ${result.error ?? "no se pudo subir"}`); continue; }
        setImages(result.images);
        ok++;
      } catch {
        problems.push(`${file.name}: falló la conexión`);
      }
    }
    setUploading(null);
    void load();
    setMessage([ok ? `Se subieron ${ok} imágenes.` : "", ...problems].filter(Boolean).join(" · "));
  }

  async function removeImage(url: string) {
    if (!editing) return;
    const response = await fetch(`/api/admin/products/${editing}/images?url=${encodeURIComponent(url)}`, { method: "DELETE" });
    if (response.ok) { setImages((await response.json()).images); void load(); }
  }

  const set = (key: keyof typeof emptyForm, value: string | boolean) => setForm({ ...form, [key]: value });

  // El precio en efectivo se puede cargar a mano o calcular desde el de contado con un descuento en % o en $.
  const withDiscount = (listPrice: string, type: DiscountType, value: string) => {
    const amount = Number(value.replace(",", "."));
    return amount > 0 && Number(listPrice) > 0 ? String(cashFromDiscount(Number(listPrice), type, amount)) : null;
  };
  const changeListPrice = (digits: string) => {
    const cash = withDiscount(digits, discountType, discountValue);
    setForm({ ...form, listPrice: digits, ...(cash !== null ? { cashPrice: cash } : {}) });
  };
  const changeDiscount = (type: DiscountType, value: string) => {
    setDiscountType(type);
    setDiscountValue(value);
    const cash = withDiscount(form.listPrice, type, value);
    if (cash !== null) setForm({ ...form, cashPrice: cash });
  };
  const changeCashPrice = (digits: string) => { setDiscountValue(""); setForm({ ...form, cashPrice: digits }); };
  const implied = impliedDiscount(Number(form.listPrice), Number(form.cashPrice));
  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));

  return <>
    <p>CATÁLOGO</p>
    <h1>{editing ? "Editar producto" : "Productos"}</h1>
    <form className="product-form" onSubmit={save}>
      <input value={form.sku} onChange={(e) => set("sku", e.target.value)} placeholder="SKU (código único)" required />
      <input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Nombre" required />
      <CategoryPicker nodes={nodes} value={form.categoryId} onChange={(id) => set("categoryId", id)} />
      <input value={form.brand} onChange={(e) => set("brand", e.target.value)} placeholder="Marca" list="brands" />
      <datalist id="brands">{brands.map((brand) => <option key={brand} value={brand} />)}</datalist>
      <label className="field">Precio en efectivo ($)
        <input value={form.cashPrice} onChange={(e) => changeCashPrice(e.target.value.replace(/\D/g, ""))} placeholder="Precio en efectivo" inputMode="numeric" required />
      </label>
      <label className="field">Precio de contado ($)
        <input value={form.listPrice} onChange={(e) => changeListPrice(e.target.value.replace(/\D/g, ""))} placeholder="Precio de contado" inputMode="numeric" required />
      </label>
      <div className="cash-discount">
        <b>Descuento en efectivo</b>
        <select value={discountType} onChange={(e) => changeDiscount(e.target.value as DiscountType, discountValue)} aria-label="Tipo de descuento">
          <option value="percent">Porcentaje (%)</option>
          <option value="amount">Monto ($)</option>
        </select>
        <input value={discountValue} onChange={(e) => changeDiscount(discountType, e.target.value.replace(/[^\d.,]/g, ""))} placeholder={discountType === "percent" ? "Ej. 15" : "Ej. 5000"} inputMode="decimal" aria-label="Valor del descuento" />
        <small>{discountValue && Number(form.listPrice) > 0 ? "El precio en efectivo se calcula desde el de contado. " : "Cargá el precio de contado y elegí el descuento para calcular el efectivo. "}{implied ? `Hoy equivale a ${implied.percent} % (−${pesos.format(implied.amount)}).` : Number(form.cashPrice) > 0 && Number(form.listPrice) > 0 ? "El efectivo no es menor al de contado." : ""}</small>
      </div>
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
        <div className={`image-dropzone${dragging ? " dragging" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); void uploadMany([...e.dataTransfer.files]); }}>
          <input id="product-images" type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={!!uploading}
            onChange={(e) => { void uploadMany([...(e.target.files ?? [])]); e.target.value = ""; }} />
          <small>{uploading ? `Subiendo ${uploading.done + 1} de ${uploading.total}…` : `Elegí varias a la vez (Ctrl o Shift) o arrastralas acá. ${images.length} de ${MAX_IMAGES_PER_PRODUCT}.`}</small>
        </div>
      </div> : <small>Guardá el producto para poder cargarle imágenes.</small>}
      <button>{editing ? "Guardar cambios" : "Crear producto"}</button>
      {editing ? <button type="button" onClick={reset}>Cancelar</button> : null}
      <small>{message}</small>
    </form>

    <input className="admin-search" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder="Buscar por nombre, marca o SKU" />
    <div className="product-admin-list">
      {data.items.map((product) => (
        <article key={product.id}>
          <span>{product.image ? <img src={normalizeImageUrl(product.image, 120)} alt="" width={40} height={40} /> : <ImagePlaceholder label="Sin foto" />}</span>
          <div><b>{product.name}</b><small>{product.sku} · {product.categoryId ? formatPath(nodePath(nodes, product.categoryId)) : product.category}{product.available ? "" : " · no disponible"}{product.active ? "" : " · INACTIVO"}</small></div>
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
