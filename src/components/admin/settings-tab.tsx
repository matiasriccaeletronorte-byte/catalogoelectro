"use client";

import { FormEvent, useEffect, useState } from "react";
import type { Branch } from "@/lib/branches";
import { shrinkImage } from "@/lib/client-image";
import { DEFAULT_TEMPLATE } from "@/lib/whatsapp";

export function SettingsTab() {
  const [phone, setPhone] = useState("");
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE);
  const [dates, setDates] = useState<string[]>([]);
  const [newDate, setNewDate] = useState("");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [categoryImages, setCategoryImages] = useState<{ name: string; image: string }[]>([]);
  const [categoryNames, setCategoryNames] = useState<string[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/admin/settings").then((r) => (r.ok ? r.json() : null)).then((s) => {
      if (!s) return;
      setPhone(s.whatsappPhone); setTemplate(s.whatsappTemplate || DEFAULT_TEMPLATE); setDates(s.bbvaDates); setBranches(s.branches ?? []); setCategoryImages(s.categoryImages ?? []);
    });
    fetch("/api/products").then((r) => (r.ok ? r.json() : null)).then((data) => {
      if (data) setCategoryNames((data.facets?.categories ?? []).map((c: { value: string }) => c.value));
    });
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/admin/settings", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ whatsappPhone: phone, whatsappTemplate: template, bbvaDates: dates, branches, categoryImages })
    });
    setMessage(response.ok ? "Guardado." : "No se pudo guardar. Revisá los datos.");
  }

  const updateBranch = (index: number, field: keyof Branch, value: string) =>
    setBranches(branches.map((branch, i) => (i === index ? { ...branch, [field]: value } : branch)));
  const addBranch = () => setBranches([...branches, { name: "", city: "", phone: "", whatsapp: "", query: "" }]);

  async function uploadCategoryImage(name: string, file: File | undefined) {
    if (!file) return;
    const body = new FormData();
    body.set("file", await shrinkImage(file, 800));
    const response = await fetch("/api/admin/banner-image", { method: "POST", body });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return setMessage(result.error ?? "No se pudo subir la imagen.");
    setCategoryImages([...categoryImages.filter((item) => item.name !== name), { name, image: result.url }]);
    setMessage("Imagen subida. Tocá Guardar para publicarla.");
  }

  function addDate() {
    if (newDate && !dates.includes(newDate)) setDates([...dates, newDate].sort());
    setNewDate("");
  }

  return <form className="product-form" onSubmit={save}>
    <p>AJUSTES</p>
    <h1>WhatsApp y promos</h1>
    <h2>WhatsApp</h2>
    <label>Número (con código de país, ej. 5491154560043)
      <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="5491154560043" />
    </label>
    <label>Mensaje (usá {"{nombre}"}, {"{sku}"} y {"{link}"})
      <textarea value={template} onChange={(e) => setTemplate(e.target.value)} rows={3} />
    </label>

    <h2>Días de 6 cuotas con BBVA</h2>
    <small>Cargá la fecha cada mes. Ese día se muestra la promo en todo el catálogo.</small>
    <div>
      <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
      <button type="button" onClick={addDate}>Agregar fecha</button>
    </div>
    <ul>
      {dates.map((d) => <li key={d}>{d} <button type="button" onClick={() => setDates(dates.filter((x) => x !== d))}>Quitar</button></li>)}
    </ul>

    <h2>Sucursales</h2>
    <small>Se muestran al final del inicio, con un mapa de cada una. "Dirección para el mapa" es lo que busca Google Maps (calle, número y localidad).</small>
    {branches.map((branch, index) => <fieldset key={index}>
      <input value={branch.name} onChange={(e) => updateBranch(index, "name", e.target.value)} placeholder="Nombre / calle y número" required />
      <input value={branch.city} onChange={(e) => updateBranch(index, "city", e.target.value)} placeholder="Localidad (ej. Los Polvorines, Buenos Aires)" />
      <input value={branch.phone} onChange={(e) => updateBranch(index, "phone", e.target.value)} placeholder="Teléfono (ej. 011 5456-0043)" />
      <input value={branch.whatsapp} onChange={(e) => updateBranch(index, "whatsapp", e.target.value)} placeholder="WhatsApp con código de país (ej. 5491154560043)" />
      <input value={branch.query} onChange={(e) => updateBranch(index, "query", e.target.value)} placeholder="Dirección para el mapa" />
      <button type="button" onClick={() => setBranches(branches.filter((_, i) => i !== index))}>Quitar sucursal</button>
    </fieldset>)}
    <button type="button" onClick={addBranch}>Agregar sucursal</button>

    <h2>Imágenes de las categorías</h2>
    <small>Se ven en el selector rápido de la home. Si una categoría no tiene imagen, se usa la foto de uno de sus artículos. Mejor con fondo transparente o blanco y el producto centrado.</small>
    {categoryNames.map((name) => {
      const current = categoryImages.find((item) => item.name === name);
      return <div className="slide-image-field" key={name}>
        {current ? <img src={current.image} alt={name} style={{ width: 56, height: 56, objectFit: "contain" }} /> : <span style={{ width: 56, height: 56 }}>Auto</span>}
        <b>{name}</b>
        <label className="slide-image-upload">{current ? "Cambiar" : "Subir imagen"}
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => { void uploadCategoryImage(name, e.target.files?.[0]); e.target.value = ""; }} />
        </label>
        {current ? <button type="button" onClick={() => setCategoryImages(categoryImages.filter((item) => item.name !== name))}>Quitar</button> : null}
      </div>;
    })}

    <button type="submit">Guardar</button>
    <small>{message}</small>
  </form>;
}
