"use client";

import { useEffect, useState } from "react";
import { activePromos, installmentValue } from "@/lib/installments";
import type { Product } from "@/lib/types";
import { useSiteSettings } from "./site-settings-provider";

const pesos = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

export function PriceBlock({ product }: { product: Product }) {
  const { bbvaDates } = useSiteSettings();
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);
  const promos = now ? activePromos(now, bbvaDates) : [];
  return <div className="price-block">
    <strong className="price-cash">{pesos.format(product.cashPrice)}</strong>
    <small className="price-label">Precio efectivo</small>
    <span className="price-list">{pesos.format(product.listPrice)} <small>Precio transferencia/débito</small></span>
    {promos.map((promo) => <span className="price-promo" key={promo.id}>{promo.label} de {pesos.format(installmentValue(product.listPrice, promo.installments))}</span>)}
  </div>;
}
