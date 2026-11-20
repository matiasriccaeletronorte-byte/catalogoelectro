"use client";

import { buildWhatsappUrl, DEFAULT_TEMPLATE } from "@/lib/whatsapp";
import { phoneDigits } from "@/lib/branch-contact";
import type { Product } from "@/lib/types";
import { useBranch } from "./branch-provider";
import { useSiteSettings } from "./site-settings-provider";

export function WhatsappButton({ product, className = "whatsapp-button" }: { product: Product; className?: string }) {
  const { whatsappTemplate, siteOrigin } = useSiteSettings();
  const { branches, selected, fallbackPhone, ask } = useBranch();
  const link = `${siteOrigin}/productos/${product.id}`;
  const urlFor = (phone: string) => buildWhatsappUrl(phone, whatsappTemplate || DEFAULT_TEMPLATE, { name: product.name, sku: product.sku, link });

  // sin sucursales con WhatsApp se usa el número general, como antes
  if (branches.length === 0) {
    const href = urlFor(fallbackPhone);
    return href ? <a className={className} href={href} target="_blank" rel="noreferrer">Consultar por WhatsApp</a> : null;
  }
  if (selected) return <a className={className} href={urlFor(phoneDigits(selected))} target="_blank" rel="noreferrer">Consultar por WhatsApp</a>;
  return <button type="button" className={className} onClick={() => ask((branch) => window.open(urlFor(phoneDigits(branch)), "_blank", "noopener,noreferrer"))}>Consultar por WhatsApp</button>;
}
