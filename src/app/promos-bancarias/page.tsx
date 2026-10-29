"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type BankPromo = { title: string; description: string; note: string };

export default function BankPromotionsPage() {
  const [bankPromotions, setBankPromotions] = useState<BankPromo[]>([]);

  useEffect(() => {
    fetch("/api/homepage")
      .then((res) => (res.ok ? res.json() : { bankPromotions: [] }))
      .then((data) => setBankPromotions(data.bankPromotions ?? []));
  }, []);

  return (
    <main className="admin" style={{ maxWidth: "1280px" }}>
      <p>PROMOS BANCARIAS</p>
      <h1>Opciones de financiación</h1>
      <p className="form-message">
        Acá podés mostrar las promociones bancarias vigentes y la información que cargue el administrador.
      </p>

      <div className="promo-bank-strip" style={{ marginTop: 24 }}>
        <div>
          <p className="eyebrow">Tarjetas adheridas</p>
          <h2>Consultá beneficios y cuotas según el banco o tarjeta.</h2>
        </div>
        <Link href="/catalogo" className="primary-link">
          Volver al catálogo
        </Link>
      </div>

      <section className="offers">
        <div className="bank-promo-grid">
          {bankPromotions.length === 0 ? (
            <div className="empty-state">Todavía no se cargaron promociones bancarias.</div>
          ) : (
            bankPromotions.map((promo, index) => (
              <article className="bank-promo-card" key={`${promo.title}-${index}`}>
                <p className="eyebrow">{promo.title || "Promo"}</p>
                <h3>{promo.description || "Promoción disponible"}</h3>
                <span>{promo.note || "Consultá condiciones en el local."}</span>
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
