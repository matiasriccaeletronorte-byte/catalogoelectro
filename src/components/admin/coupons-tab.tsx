"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { describeCoupon, timeLeftLabel } from "@/lib/coupons";

type Item = { productId: string; sku: string; name: string };
type CouponRow = { code: string; type: "percent" | "fixed"; value: number; minTotal: number; endsAt: string | null; note: string; active: boolean; items?: Item[]; durationMinutes?: number };
type Found = { id: string; sku: string; name: string };

const DURATIONS = [{ label: "30 minutos", minutes: 30 }, { label: "1 hora", minutes: 60 }, { label: "2 horas", minutes: 120 }, { label: "6 horas", minutes: 360 }, { label: "24 horas", minutes: 1440 }];

const dateLabel = (value: string | null) => (value ? new Date(value).toLocaleDateString("es-AR") : "Sin vencimiento");
const expired = (coupon: CouponRow) => !!coupon.endsAt && new Date(coupon.endsAt).getTime() < Date.now();
const dateTimeLabel = (value: string) => new Date(value).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });

export function CouponsTab() {
  const [coupons, setCoupons] = useState<CouponRow[]>([]);
  const [type, setType] = useState<"percent" | "fixed">("percent");
  const [message, setMessage] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<Found[]>([]);
  const [minutes, setMinutes] = useState("");
  const [, setTick] = useState(0);

  // el tiempo que queda se refresca solo cada 30 segundos
  useEffect(() => { const timer = window.setInterval(() => setTick((n) => n + 1), 30_000); return () => window.clearInterval(timer); }, []);

  useEffect(() => {
    const text = query.trim();
    if (text.length < 2) { setFound([]); return; }
    const timer = window.setTimeout(() => {
      fetch(`/api/products?q=${encodeURIComponent(text)}`).then((r) => (r.ok ? r.json() : { items: [] })).then((data) => setFound((data.items ?? []).slice(0, 8)));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  const addItem = (product: Found) => {
    if (!items.some((item) => item.productId === product.id)) setItems([...items, { productId: product.id, sku: product.sku, name: product.name }]);
    setQuery("");
    setFound([]);
  };

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/coupons");
    if (response.ok) setCoupons(await response.json());
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function send(method: "POST" | "PATCH" | "DELETE", body: object, fallback: string) {
    const response = await fetch("/api/admin/coupons", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!response.ok) { setMessage((await response.json().catch(() => ({}))).error ?? fallback); return false; }
    setMessage("");
    void load();
    return true;
  }

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const created = await send("POST", {
      code: String(data.get("code") ?? ""), type, value: String(data.get("value") ?? ""),
      minTotal: String(data.get("minTotal") || "0"), endsAt: String(data.get("endsAt") ?? "") || null,
      note: String(data.get("note") ?? ""), active: true, items, minutes: minutes ? Number(minutes) : null
    }, "No se pudo crear el cupón.");
    if (created) { form.reset(); setItems([]); setMinutes(""); }
  }

  return (
    <>
      <p>VENTAS</p>
      <h1>Cupones de descuento</h1>
      <form className="coupon-form" onSubmit={add}>
        <input name="code" placeholder="Código (ej. VERANO10)" required maxLength={24} />
        <select value={type} onChange={(event) => setType(event.target.value as "percent" | "fixed")} aria-label="Tipo de descuento">
          <option value="percent">Porcentaje (%)</option>
          <option value="fixed">Monto fijo ($)</option>
        </select>
        <input name="value" type="number" min="1" step="any" placeholder={type === "percent" ? "% de descuento" : "$ de descuento"} required />
        <input name="minTotal" type="number" min="0" step="any" placeholder="Compra mínima $ (opcional)" />
        <label className="coupon-date">Vence <input name="endsAt" type="date" /></label>
        <select value={minutes} onChange={(event) => setMinutes(event.target.value)} aria-label="Temporizador">
          <option value="">Sin temporizador</option>
          {DURATIONS.map((d) => <option key={d.minutes} value={d.minutes}>Dura {d.label} desde que se crea</option>)}
        </select>
        <input name="note" placeholder="Nota interna (opcional)" maxLength={120} />
        <button>Crear cupón</button>
      </form>
      <div className="coupon-items">
        <label>Aplica a
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={items.length ? "Agregar otro artículo (nombre o código)" : "Todos los artículos. Buscá un artículo para limitar el cupón a una lista."} />
        </label>
        {found.length > 0 ? <ul className="coupon-found">{found.map((product) => <li key={product.id}><button type="button" onClick={() => addItem(product)}>{product.sku} · {product.name}</button></li>)}</ul> : null}
        {items.length > 0 ? <ul className="coupon-chosen">{items.map((item) => <li key={item.productId}>{item.sku} · {item.name} <button type="button" aria-label={`Quitar ${item.name}`} onClick={() => setItems(items.filter((x) => x.productId !== item.productId))}>×</button></li>)}</ul> : null}
      </div>
      {message ? <small role="alert" className="coupon-error">{message}</small> : null}
      <div className="coupon-list">
        {coupons.length === 0 ? <small>Todavía no creaste cupones.</small> : coupons.map((coupon) => {
          const off = !coupon.active || expired(coupon);
          const left = coupon.endsAt && !off ? timeLeftLabel(coupon.endsAt) : "";
          const count = coupon.items?.length ?? 0;
          return <div key={coupon.code} className={`brand-row${off ? " coupon-off" : ""}`}>
            <b>{coupon.code}</b>
            <span>
              {describeCoupon(coupon)} · {count > 0 ? `${count} ${count === 1 ? "artículo" : "artículos"}` : "todos los artículos"} · {expired(coupon) ? "Vencido" : coupon.endsAt ? (coupon.durationMinutes ? `vence ${dateTimeLabel(coupon.endsAt)} (quedan ${left})` : dateLabel(coupon.endsAt)) : "Sin vencimiento"}{coupon.note ? ` · ${coupon.note}` : ""}
              {count > 0 ? <small className="coupon-item-names">{coupon.items!.map((item) => `${item.sku} ${item.name}`).join(" · ")}</small> : null}
            </span>
            <select aria-label={`Activar ${coupon.code} por un tiempo`} value="" onChange={(event) => { if (event.target.value) void send("PATCH", { code: coupon.code, minutes: Number(event.target.value) }, "No se pudo activar el cupón."); }}>
              <option value="">{coupon.durationMinutes ? "Reiniciar por…" : "Activar por…"}</option>
              {DURATIONS.map((d) => <option key={d.minutes} value={d.minutes}>{d.label}</option>)}
            </select>
            {coupon.endsAt && coupon.durationMinutes ? <button type="button" className="row-action" onClick={() => void send("PATCH", { code: coupon.code, clearTimer: true }, "No se pudo quitar el temporizador.")}>Quitar tiempo</button> : null}
            <button type="button" className="row-action" onClick={() => void send("PATCH", { code: coupon.code, active: !coupon.active }, "No se pudo cambiar el cupón.")}>{coupon.active ? "Desactivar" : "Activar"}</button>
            <button type="button" className="row-action danger" onClick={() => { if (window.confirm(`¿Eliminar el cupón ${coupon.code}?`)) void send("DELETE", { code: coupon.code }, "No se pudo eliminar el cupón."); }}>Eliminar</button>
          </div>;
        })}
      </div>
    </>
  );
}
