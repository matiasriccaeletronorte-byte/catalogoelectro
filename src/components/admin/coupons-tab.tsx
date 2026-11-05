"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { describeCoupon } from "@/lib/coupons";

type CouponRow = { code: string; type: "percent" | "fixed"; value: number; minTotal: number; endsAt: string | null; note: string; active: boolean };

const dateLabel = (value: string | null) => (value ? new Date(value).toLocaleDateString("es-AR") : "Sin vencimiento");
const expired = (coupon: CouponRow) => !!coupon.endsAt && new Date(coupon.endsAt).getTime() < Date.now();

export function CouponsTab() {
  const [coupons, setCoupons] = useState<CouponRow[]>([]);
  const [type, setType] = useState<"percent" | "fixed">("percent");
  const [message, setMessage] = useState("");

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
      note: String(data.get("note") ?? ""), active: true
    }, "No se pudo crear el cupón.");
    if (created) form.reset();
  }

  return (
    <>
      <p>VENTAS</p>
      <h1>Cupones de descuento</h1>
      <small>El cliente escribe el código en “Tu pedido” y el descuento se aplica a los dos totales (efectivo y contado). Va en el mensaje de WhatsApp para que lo confirmes.</small>
      <form className="coupon-form" onSubmit={add}>
        <input name="code" placeholder="Código (ej. VERANO10)" required maxLength={24} />
        <select value={type} onChange={(event) => setType(event.target.value as "percent" | "fixed")} aria-label="Tipo de descuento">
          <option value="percent">Porcentaje (%)</option>
          <option value="fixed">Monto fijo ($)</option>
        </select>
        <input name="value" type="number" min="1" step="any" placeholder={type === "percent" ? "% de descuento" : "$ de descuento"} required />
        <input name="minTotal" type="number" min="0" step="any" placeholder="Compra mínima $ (opcional)" />
        <label className="coupon-date">Vence <input name="endsAt" type="date" /></label>
        <input name="note" placeholder="Nota interna (opcional)" maxLength={120} />
        <button>Crear cupón</button>
      </form>
      {message ? <small role="alert" className="coupon-error">{message}</small> : null}
      <div className="coupon-list">
        {coupons.length === 0 ? <small>Todavía no creaste cupones.</small> : coupons.map((coupon) => {
          const off = !coupon.active || expired(coupon);
          return <div key={coupon.code} className={`brand-row${off ? " coupon-off" : ""}`}>
            <b>{coupon.code}</b>
            <span>{describeCoupon(coupon)} · {expired(coupon) ? "Vencido" : dateLabel(coupon.endsAt)}{coupon.note ? ` · ${coupon.note}` : ""}</span>
            <button type="button" className="row-action" onClick={() => void send("PATCH", { code: coupon.code, active: !coupon.active }, "No se pudo cambiar el cupón.")}>{coupon.active ? "Desactivar" : "Activar"}</button>
            <button type="button" className="row-action danger" onClick={() => { if (window.confirm(`¿Eliminar el cupón ${coupon.code}?`)) void send("DELETE", { code: coupon.code }, "No se pudo eliminar el cupón."); }}>Eliminar</button>
          </div>;
        })}
      </div>
    </>
  );
}
