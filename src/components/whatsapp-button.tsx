"use client";

import { buildWhatsappUrl, DEFAULT_TEMPLATE } from "@/lib/whatsapp";
import type { Product } from "@/lib/types";
import { useSiteSettings } from "./site-settings-provider";

export function WhatsappButton({ product, className = "whatsapp-button" }: { product: Product; className?: string }) {
  const { whatsappPhone, whatsappTemplate, siteOrigin } = useSiteSettings();
  const link = `${siteOrigin}/productos/${product.id}`;
  const href = buildWhatsappUrl(whatsappPhone, whatsappTemplate || DEFAULT_TEMPLATE, { name: product.name, sku: product.sku, link });
  if (!href) return null;
  return <a className={className} href={href} target="_blank" rel="noreferrer">Consultar por WhatsApp</a>;
}
