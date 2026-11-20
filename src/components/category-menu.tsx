"use client";

import Link from "next/link";
import { KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";
import type { MenuNode } from "@/lib/category-tree";

const DESKTOP = "(min-width: 861px)";

export function CategoryMenu({ menu }: { menu: MenuNode[] }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const timer = useRef<number | undefined>(undefined);

  const close = useCallback((restoreFocus = false) => {
    window.clearTimeout(timer.current);
    setOpen(false);
    setActive(null);
    if (restoreFocus) trigger.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => { if (!box.current?.contains(event.target as Node)) close(); };
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") { event.stopPropagation(); close(true); return; }
      // en celular el panel ocupa toda la pantalla: el foco no sale de él mientras está abierto
      if (event.key === "Tab" && !window.matchMedia(DESKTOP).matches && box.current) {
        const items = [...box.current.querySelectorAll<HTMLElement>("button, a[href]")].filter((item) => item.offsetParent !== null);
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open, close]);

  if (menu.length === 0) return null;
  const current = menu.find((item) => item.id === active) ?? null;

  const toggle = () => {
    if (open) return close();
    const desktop = window.matchMedia(DESKTOP).matches;
    if (!desktop && trigger.current) box.current?.style.setProperty("--menu-top", `${Math.round(trigger.current.getBoundingClientRect().bottom)}px`);
    setOpen(true);
    setActive(desktop ? (menu.find((item) => item.children.length > 0)?.id ?? null) : null);
  };
  const hover = (id: string) => {
    if (!window.matchMedia(DESKTOP).matches) return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setActive(id), 90);
  };
  const onListKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const items = [...(box.current?.querySelectorAll<HTMLElement>(".menu-root") ?? [])];
    const index = items.indexOf(document.activeElement as HTMLElement);
    if (index < 0) return;
    event.preventDefault();
    items[(index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length].focus();
  };

  return <div className="category-menu" ref={box}>
    <button ref={trigger} type="button" className={`dropdown-trigger${open ? " active" : ""}`} aria-expanded={open} aria-controls="category-menu-panel" onClick={toggle}>
      <span>Categorías</span><strong aria-hidden="true">{open ? "✕" : "▾"}</strong>
    </button>
    {open ? <div className={`menu-panel${current ? " has-sub" : ""}`} id="category-menu-panel">
      <div className="menu-roots" onKeyDown={onListKey} onMouseLeave={() => window.clearTimeout(timer.current)}>
        {menu.map((item) => item.children.length === 0
          ? <Link prefetch={false} key={item.id} href={item.href} className="menu-root" onClick={() => close()}>{item.name}</Link>
          : <button key={item.id} type="button" className={`menu-root${active === item.id ? " active" : ""}`} aria-expanded={active === item.id} onMouseEnter={() => hover(item.id)} onClick={() => setActive(item.id)}>
              <span>{item.name}</span><em aria-hidden="true">›</em>
            </button>)}
      </div>
      {current ? <div className="menu-sub">
        <button type="button" className="menu-back" onClick={() => setActive(null)}>← Volver</button>
        <div className="menu-sub-head">
          <h3>{current.name}</h3>
          <Link prefetch={false} href={current.href} className="menu-all" onClick={() => close()}>Ver todo</Link>
        </div>
        <div className="menu-cols">
          {current.children.map((child) => <div className="menu-col" key={child.id}>
            <Link prefetch={false} href={child.href} className="menu-col-title" onClick={() => close()}>{child.name}</Link>
            {child.children.map((leaf) => <Link prefetch={false} key={leaf.id} href={leaf.href} onClick={() => close()}>{leaf.name}</Link>)}
            {child.children.length > 0 ? <Link prefetch={false} href={child.href} className="menu-col-all" onClick={() => close()}>Ver todo</Link> : null}
          </div>)}
        </div>
      </div> : null}
    </div> : null}
  </div>;
}
