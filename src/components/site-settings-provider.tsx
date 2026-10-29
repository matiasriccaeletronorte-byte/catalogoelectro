"use client";

import { createContext, useContext } from "react";
import type { SiteSettings } from "@/lib/site-settings";

const SiteSettingsContext = createContext<SiteSettings>({ whatsappPhone: "", whatsappTemplate: "", bbvaDates: [] });

export function SiteSettingsProvider({ initial, children }: { initial: SiteSettings; children: React.ReactNode }) {
  return <SiteSettingsContext.Provider value={initial}>{children}</SiteSettingsContext.Provider>;
}

export const useSiteSettings = () => useContext(SiteSettingsContext);
