"use client";

import { useEffect, useState } from "react";
import { activePromos, installmentValue, nextPromo } from "@/lib/installments";
import type { Product } from "@/lib/types";
import { useSiteSettings } from "./site-settings-provider";

const pesos = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

export function PriceBlock({ product }: { product: Product }) {
  const { bbvaDates } = useSiteSettings();
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);
  const promos = now ? activePromos(now, bbvaDates) : [];
  const next = now ? nextPromo(now, bbvaDates) : null;
  return <div className="price-block">
    <strong className="price-cash">{pesos.format(product.cashPrice)}<small> efectivo</small></strong>
    <span className="price-list">{pesos.format(product.listPrice)} contado</span>
    {promos.map((promo) => <span className="price-promo" key={promo.id}>{promo.label} de {pesos.format(installmentValue(product.listPrice, promo.installments))}</span>)}
    {now && promos.length === 0 && next ? <span className="price-next">Próxima promo de cuotas: {next.label}</span> : null}
  </div>;
}
