"use client";

import { FormEvent, useState } from "react";

export type BrandRow = { name: string; count: number };

export function BrandsTab({ brands, onChange }: { brands: BrandRow[]; onChange: () => void }) {
  const [message, setMessage] = useState("");

  async function send(method: "POST" | "PATCH" | "DELETE", body: object, fallback: string) {
    const response = await fetch("/api/admin/brands", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!response.ok) { setMessage((await response.json().catch(() => ({}))).error ?? fallback); return false; }
    setMessage("");
    onChange();
    return true;
  }

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const name = String(new FormData(form).get("brand") ?? "").trim();
    if (name && (await send("POST", { name }, "No se pudo crear la marca."))) form.reset();
  }

  async function rename(brand: BrandRow) {
    const newName = window.prompt(`Nuevo nombre para la marca "${brand.name}":`, brand.name)?.trim();
    if (!newName || newName === brand.name) return;
    await send("PATCH", { name: brand.name, newName }, "No se pudo renombrar la marca.");
  }

  async function remove(brand: BrandRow) {
    if (!window.confirm(`¿Eliminar la marca "${brand.name}"?`)) return;
    await send("DELETE", { name: brand.name }, "No se pudo eliminar la marca.");
  }

  return (
    <>
      <p>ORGANIZACIÓN</p>
      <h1>Marcas</h1>
      <form className="category-form" onSubmit={add}>
        <input name="brand" placeholder="Nueva marca" required maxLength={40} />
        <button>Agregar</button>
      </form>
      <small>Al renombrar una marca se actualiza en todos los artículos. Si el nombre nuevo ya existe, las dos se unen. Solo se puede eliminar una marca sin artículos.</small>
      {message ? <small role="alert">{message}</small> : null}
      <div className="brand-list">
        {brands.length === 0 ? <small>Todavía no hay marcas.</small> : brands.map((brand) => (
          <div key={brand.name} className="brand-row">
            <b>{brand.name}</b>
            <span>{brand.count} {brand.count === 1 ? "artículo" : "artículos"}</span>
            <button type="button" className="row-action" onClick={() => void rename(brand)}>Renombrar</button>
            <button type="button" className="row-action danger" onClick={() => void remove(brand)}>Eliminar</button>
          </div>
        ))}
      </div>
    </>
  );
}
