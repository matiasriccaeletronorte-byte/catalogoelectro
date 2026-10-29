"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Customer = { id: string; name: string; email: string; picture: string };
type Order = { id: string; total: number; status: string; createdAt: string; customer: { name: string; email: string; phone: string; address: string }; items: { name: string; quantity: number; price: number }[] };

const pesos = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const statusInfo: Record<string, { label: string; description: string }> = {
  pending_review: { label: "En revisión", description: "Estamos confirmando stock y envío." },
  approved: { label: "Aprobado", description: "Tu pedido fue aprobado. Te contactaremos con el pago." },
  paid: { label: "Pagado", description: "Pago confirmado. Estamos preparando el despacho." },
  shipped: { label: "Despachado", description: "Tu pedido ya está en camino." },
  cancelled: { label: "Cancelado", description: "El pedido fue cancelado." }
};

export default function AccountPage() {
  const [customer, setCustomer] = useState<Customer | null>(null); const [orders, setOrders] = useState<Order[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [openOrder, setOpenOrder] = useState<string | null>(null);
  useEffect(() => { async function load() { try { const me = await fetch("/api/auth/customer/me").then(r => r.json()); if (!me.authenticated) { setCustomer(null); return; } setCustomer(me.customer); const history = await fetch("/api/customer/orders"); if (!history.ok) throw new Error(); const data = await history.json(); setOrders(Array.isArray(data) ? data : []); } catch { setError("No pudimos cargar tu historial en este momento."); } finally { setLoading(false); } } void load(); }, []);
  async function logout() { await fetch("/api/auth/customer/me", { method: "DELETE" }); window.location.assign("/"); }
  const totalSpent = useMemo(() => orders.reduce((sum, order) => sum + order.total, 0), [orders]);
  const lastOrder = orders[0];

  if (loading) return <main className="account-page"><div className="account-skeleton"/><div className="account-skeleton short"/></main>;
  if (!customer) return <main className="account-page account-guest"><p className="account-eyebrow">MI CUENTA</p><h1>Tu historial, siempre a mano.</h1><p>Ingresá con Google para consultar tus pedidos y seguir cada compra.</p><div><Link className="primary-link" href="/api/auth/customer/google/start?returnTo=/account">Ingresar con Google</Link><Link className="secondary-link" href="/#catalogo">Ver productos</Link></div></main>;

  return <main className="account-page"><section className="account-hero"><div className="account-avatar">{customer.picture ? <img src={customer.picture} alt=""/> : customer.name.slice(0, 1).toUpperCase()}</div><div><p className="account-eyebrow">MI CUENTA</p><h1>Hola, {customer.name.split(" ")[0]}</h1><p>{customer.email}</p></div><button className="account-logout" type="button" onClick={logout}>Cerrar sesión</button></section><section className="account-stats"><article><span>Pedidos realizados</span><b>{orders.length}</b></article><article><span>Total comprado</span><b>{pesos.format(totalSpent)}</b></article><article><span>Último pedido</span><b>{lastOrder ? statusInfo[lastOrder.status]?.label ?? "Actualizado" : "Sin pedidos"}</b></article></section><section className="account-orders"><div className="account-section-head"><div><p className="account-eyebrow">HISTORIAL</p><h2>Tus pedidos</h2></div><Link href="/#catalogo">Seguir comprando →</Link></div>{error ? <div className="account-message error">{error}</div> : orders.length === 0 ? <div className="account-message"><b>Todavía no tenés compras registradas.</b><span>Cuando realices un pedido, vas a poder seguirlo desde acá.</span><Link className="primary-link" href="/#catalogo">Explorar el catálogo</Link></div> : <div className="account-order-list">{orders.map(order => { const info = statusInfo[order.status] ?? { label: "Actualizado", description: "Tu pedido fue actualizado." }; const expanded = openOrder === order.id; return <article className="account-order" key={order.id}><div className="account-order-top"><div><span className={`status status-${order.status}`}>{info.label}</span><h3>Pedido #{order.id.slice(-6).toUpperCase()}</h3><p>{new Date(order.createdAt).toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" })} · {info.description}</p></div><div className="account-order-total"><b>{pesos.format(order.total)}</b><button type="button" onClick={() => setOpenOrder(expanded ? null : order.id)}>{expanded ? "Ocultar detalle" : "Ver detalle"}</button></div></div>{expanded && <div className="account-order-detail"><div>{order.items.map((item, index) => <p key={index}><span>{item.quantity}× {item.name}</span><b>{pesos.format(item.price * item.quantity)}</b></p>)}</div><aside><b>Entrega</b><span>{order.customer.address}</span><span>{order.customer.phone}</span></aside></div>}</article>; })}</div>}</section></main>;
}
