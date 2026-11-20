"use client";

import { createContext, useContext } from "react";
import type { SiteSettings } from "@/lib/site-settings";

type SiteContext = SiteSettings & { siteOrigin: string };

const SiteSettingsContext = createContext<SiteContext>({ whatsappPhone: "", whatsappTemplate: "", bbvaDates: [], branches: [], categoryImages: [], siteOrigin: "" });

/** `siteOrigin` es la dirección pública del sitio: igual en el servidor y en el navegador, así los enlaces no cambian al cargar. */
export function SiteSettingsProvider({ initial, siteOrigin, children }: { initial: SiteSettings; siteOrigin: string; children: React.ReactNode }) {
  return <SiteSettingsContext.Provider value={{ ...initial, siteOrigin }}>{children}</SiteSettingsContext.Provider>;
}

export const useSiteSettings = () => useContext(SiteSettingsContext);
