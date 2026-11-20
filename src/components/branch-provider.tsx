"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Branch } from "@/lib/branches";
import { chooseBranch, contactableBranches, parseStoredBranch } from "@/lib/branch-contact";
import { BranchPicker } from "./branch-picker";
import { useSiteSettings } from "./site-settings-provider";

const STORAGE_KEY = "electronorte-sucursal";

type BranchContextValue = {
  /** Sucursales con WhatsApp cargado. */
  branches: Branch[];
  /** La elegida por el cliente (o la única disponible). `null` = todavía hay que preguntar. */
  selected: Branch | null;
  /** Número general de "WhatsApp y promos", solo se usa si ninguna sucursal tiene WhatsApp. */
  fallbackPhone: string;
  /** Abre el cuadro para elegir sucursal. `onChoose` se ejecuta al elegir (dentro del mismo clic, para que WhatsApp no sea bloqueado). */
  ask: (onChoose?: (branch: Branch) => void) => void;
};

const BranchContext = createContext<BranchContextValue>({ branches: [], selected: null, fallbackPhone: "", ask: () => undefined });

export function BranchProvider({ children }: { children: React.ReactNode }) {
  const { branches: all, whatsappPhone } = useSiteSettings();
  const branches = useMemo(() => contactableBranches(all), [all]);
  const [stored, setStored] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  // la acción pendiente va en una referencia (no dentro de un setState) para que se ejecute una sola vez
  const pending = useRef<((branch: Branch) => void) | undefined>(undefined);

  // se lee después de cargar la página: así el servidor y el navegador generan el mismo HTML
  useEffect(() => {
    try { setStored(parseStoredBranch(localStorage.getItem(STORAGE_KEY))); } catch { /* sin almacenamiento: se pregunta cada vez */ }
  }, []);

  const selected = useMemo(() => chooseBranch(branches, stored), [branches, stored]);

  const choose = useCallback((branch: Branch) => {
    setStored(branch.name);
    try { localStorage.setItem(STORAGE_KEY, branch.name); } catch { /* sin almacenamiento */ }
    const action = pending.current;
    pending.current = undefined;
    setOpen(false);
    action?.(branch);
  }, []);

  const close = useCallback(() => { pending.current = undefined; setOpen(false); }, []);

  const ask = useCallback((onChoose?: (branch: Branch) => void) => {
    if (branches.length === 1) { onChoose?.(branches[0]); return; }
    pending.current = onChoose;
    setOpen(true);
  }, [branches]);

  const value = useMemo(() => ({ branches, selected, fallbackPhone: whatsappPhone, ask }), [branches, selected, whatsappPhone, ask]);

  return <BranchContext.Provider value={value}>
    {children}
    {open ? <BranchPicker branches={branches} current={selected?.name ?? ""} onChoose={choose} onClose={close} /> : null}
  </BranchContext.Provider>;
}

export const useBranch = () => useContext(BranchContext);
