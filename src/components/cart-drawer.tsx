"use client";

import { useEffect } from "react";
import { buildCartMessage, buildCartUrl, cartTotals } from "@/lib/cart";
import { normalizeImageUrl } from "@/lib/image-url";
import { useCart } from "./cart-provider";
import { useSiteSettings } from "./site-settings-provider";

const money = (value: number) => `$${Math.round(value).toLocaleString("es-AR")}`;

export function CartDrawer() {
  const { lines, products, loading, open, setOpen, changeQty, remove, clear } = useCart();
  const { whatsappPhone } = useSiteSettings();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  if (!open) return null;
  const visible = lines.filter((line) => products.has(line.id));
  const totals = cartTotals(visible, products);
  const href = visible.length ? buildCartUrl(whatsappPhone, buildCartMessage(visible, products, window.location.origin)) : "";

  return <div className="cart-overlay" onClick={() => setOpen(false)}>
    <aside className="cart-drawer" role="dialog" aria-label="Tu pedido" onClick={(event) => event.stopPropagation()}>
      <header className="cart-head"><h2>Tu pedido</h2><button type="button" onClick={() => setOpen(false)} aria-label="Cerrar">✕</button></header>
      <div className="cart-body">
        {loading && visible.length === 0 ? <p className="cart-empty">Cargando…</p> : null}
        {!loading && lines.length === 0 ? <p className="cart-empty">Todavía no agregaste artículos. Sumalos con “Agregar al pedido”.</p> : null}
        {visible.map((line) => {
          const product = products.get(line.id)!;
          const image = normalizeImageUrl((product.images?.[0] ?? product.image) || "");
          return <div className="cart-line" key={line.id}>
            <div className="cart-thumb">{/^https?:|^\//.test(image) ? <img src={image} alt="" /> : <span>📦</span>}</div>
            <div className="cart-line-info">
              <b>{product.name}</b>
              {product.sku ? <small>SKU {product.sku}</small> : null}
              <span>Efectivo {money(product.cashPrice)} · Contado {money(product.listPrice)}</span>
              <div className="cart-qty">
                <button type="button" onClick={() => changeQty(line.id, line.qty - 1)} aria-label="Quitar uno">−</button>
                <span>{line.qty}</span>
                <button type="button" onClick={() => changeQty(line.id, line.qty + 1)} aria-label="Sumar uno">+</button>
                <button type="button" className="cart-remove" onClick={() => remove(line.id)}>Quitar</button>
              </div>
            </div>
          </div>;
        })}
      </div>
      {visible.length > 0 ? <footer className="cart-foot">
        <div className="cart-total"><span>Total en efectivo</span><b>{money(totals.cash)}</b></div>
        <div className="cart-total"><span>Total de contado</span><b>{money(totals.list)}</b></div>
        <small>Precios sujetos a confirmación por WhatsApp.</small>
        {href ? <a className="whatsapp-button large" href={href} target="_blank" rel="noreferrer">Enviar pedido por WhatsApp</a> : <p className="cart-empty">El WhatsApp de la tienda todavía no está configurado.</p>}
        <button type="button" className="cart-clear" onClick={clear}>Vaciar pedido</button>
      </footer> : null}
    </aside>
  </div>;
}
