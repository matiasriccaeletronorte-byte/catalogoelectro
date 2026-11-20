"use client";

import { useEffect, useRef } from "react";
import type { Branch } from "@/lib/branches";
import { branchLocation } from "@/lib/branch-contact";

export function BranchPicker({ branches, current, onChoose, onClose }: { branches: Branch[]; current: string; onChoose: (branch: Branch) => void; onClose: () => void }) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.focus(); // el foco va al cuadro y no a la primera sucursal, para que no parezca ya elegida
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.stopPropagation(); onClose(); return; } // no cierra también el pedido que está detrás
      if (event.key !== "Tab" || !panel.current) return;
      const items = [...panel.current.querySelectorAll<HTMLElement>("button")];
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); previous?.focus?.(); };
  }, [onClose]);

  return <div className="branch-overlay" onClick={onClose}>
    <div className="branch-picker" role="dialog" aria-modal="true" aria-labelledby="branch-picker-title" tabIndex={-1} ref={panel} onClick={(event) => event.stopPropagation()}>
      <button type="button" className="branch-close" onClick={onClose} aria-label="Cerrar">✕</button>
      <h2 id="branch-picker-title">¿A qué sucursal querés escribir?</h2>
      <p className="branch-note">Ambas sucursales están en <b>Malvinas Argentinas</b>, Provincia de Buenos Aires (no en CABA).</p>
      <div className="branch-options">
        {branches.map((branch) => <button type="button" key={branch.name} className={`branch-option${branch.name === current ? " current" : ""}`} onClick={() => onChoose(branch)}>
          <span className="branch-option-name">{branch.name}</span>
          <span className="branch-option-place">{branchLocation(branch)}</span>
          <span className="branch-option-phone">WhatsApp {branch.phone}</span>
          <span className="branch-option-cta">Escribir por WhatsApp</span>
        </button>)}
      </div>
    </div>
  </div>;
}
