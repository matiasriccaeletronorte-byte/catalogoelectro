"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useCart } from "./cart-provider";

const pesos = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

type Customer = { id: string; name: string; email: string; picture: string };

export function CheckoutForm() {
  const { items, total, remove, clear } = useCart();
  const [message, setMessage] = useState("");
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loadingCustomer, setLoadingCustomer] = useState(true);

  useEffect(() => {
    fetch("/api/auth/customer/me")
      .then(r => r.json())
      .then(data => {
        setCustomer(data.authenticated ? data.customer : null);
      })
      .finally(() => setLoadingCustomer(false));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("Enviando pedido…");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customer: Object.fromEntries(form),
        items: items.map(({ id, quantity }) => ({ productId: id, quantity }))
      })
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      return setMessage(payload.error ?? "No pudimos enviar el pedido. Revisá los datos e intentá de nuevo.");
    }
    const order = await response.json();
    clear();
    setMessage(`¡Pedido #${order.id.slice(-6).toUpperCase()} recibido! Te contactaremos tras validar stock y envío.`);
  }

  if (loadingCustomer) {
    return <main className="checkout"><p>Cargando tu sesión…</p></main>;
  }

  if (!customer) {
    return (
      <main className="checkout">
        <Link href="/" className="back">← Seguir comprando</Link>
        <h1>Finalizar pedido</h1>
        <p>Para comprar tenés que iniciar sesión con Google.</p>
        <Link className="primary-link" href="/api/auth/customer/google/start?returnTo=/checkout">
          Iniciar sesión con Google
        </Link>
      </main>
    );
  }

  if (message.startsWith("¡")) {
    return (
      <main className="checkout success">
        <h1>Pedido enviado</h1>
        <p>{message}</p>
        <Link className="primary-link" href="/">Volver al catálogo</Link>
      </main>
    );
  }

  return (
    <main className="checkout">
      <Link href="/" className="back">← Seguir comprando</Link>
      <h1>Finalizar pedido</h1>
      {items.length === 0 ? (
        <p>Tu carrito está vacío. <Link href="/">Ver productos</Link></p>
      ) : (
        <div className="checkout-grid">
          <section className="order-summary">
            <h2>Tu pedido</h2>
            {items.map(item => (
              <div className="line" key={item.id}>
                <span>{item.quantity}× {item.name}</span>
                <span>
                  {pesos.format(item.price * item.quantity)}{" "}
                  <button type="button" onClick={() => remove(item.id)} aria-label="Quitar producto">×</button>
                </span>
              </div>
            ))}
            <div className="total">Total <b>{pesos.format(total)}</b></div>
            <small>El total final se confirma al validar stock y envío.</small>
          </section>
          <form onSubmit={submit}>
            <h2>Tus datos</h2>
            <input value={customer.name} disabled />
            <input value={customer.email} disabled />
            <input name="phone" placeholder="Teléfono" type="tel" inputMode="numeric" pattern="[0-9]+" onInput={event => { event.currentTarget.value = event.currentTarget.value.replace(/\D/g, ""); }} required minLength={6} />
            <textarea name="address" placeholder="Dirección / localidad" required minLength={5} />
            <button className="submit" disabled={items.length === 0}>Enviar pedido para revisión</button>
            <p className="form-message">{message}</p>
          </form>
        </div>
      )}
    </main>
  );
}
