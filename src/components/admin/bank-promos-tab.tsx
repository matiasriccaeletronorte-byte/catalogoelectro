"use client";

import { useEffect, useState } from "react";

type BankPromo = { title: string; description: string; note: string };
const emptyPromo: BankPromo = { title: "", description: "", note: "" };

export function BankPromosTab() {
  const [promos, setPromos] = useState<BankPromo[]>([]);
  const [dates, setDates] = useState<string[]>([]);
  const [newDate, setNewDate] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/admin/homepage").then((r) => (r.ok ? r.json() : null)).then((data) => { if (data) setPromos(data.bankPromotions ?? []); });
    fetch("/api/admin/settings").then((r) => (r.ok ? r.json() : null)).then((data) => { if (data) setDates(data.bbvaDates ?? []); });
  }, []);

  const update = (index: number, field: keyof BankPromo, value: string) =>
    setPromos(promos.map((promo, i) => (i === index ? { ...promo, [field]: value } : promo)));

  function addDate() {
    if (newDate && !dates.includes(newDate)) setDates([...dates, newDate].sort());
    setNewDate("");
  }

  async function save() {
    const [promosResponse, datesResponse] = await Promise.all([
      fetch("/api/admin/homepage", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bankPromotions: promos }) }),
      fetch("/api/admin/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bbvaDates: dates }) })
    ]);
    setMessage(promosResponse.ok && datesResponse.ok ? "Guardado." : "No se pudo guardar. Revisá los datos.");
  }

  return (
    <div className="product-form">
      <p>VENTAS</p>
      <h1>Promos bancarias</h1>

      <h2>Días de 6 cuotas con BBVA</h2>
      <div>
        <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} aria-label="Fecha de 6 cuotas con BBVA" />
        <button type="button" onClick={addDate}>Agregar fecha</button>
      </div>
      <ul>
        {dates.map((d) => <li key={d}>{d} <button type="button" onClick={() => setDates(dates.filter((x) => x !== d))}>Quitar</button></li>)}
      </ul>

      <h2>Promos de bancos y tarjetas</h2>
      <div className="home-editor-actions">
        <button type="button" onClick={() => setPromos([...promos, emptyPromo])}>Agregar promo</button>
      </div>
      <div className="home-editor-stack">
        {promos.map((promo, index) => (
          <article key={index} className="home-editor-item">
            <input value={promo.title} onChange={(e) => update(index, "title", e.target.value)} placeholder="Título" maxLength={60} />
            <textarea value={promo.description} onChange={(e) => update(index, "description", e.target.value)} placeholder="Descripción" maxLength={180} />
            <input value={promo.note} onChange={(e) => update(index, "note", e.target.value)} placeholder="Nota corta" maxLength={80} />
            <button type="button" onClick={() => setPromos(promos.filter((_, i) => i !== index))}>Eliminar promo</button>
          </article>
        ))}
      </div>

      <button type="button" onClick={() => void save()}>Guardar</button>
      <small>{message}</small>
    </div>
  );
}
