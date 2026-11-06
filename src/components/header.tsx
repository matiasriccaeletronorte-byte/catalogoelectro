"use client";

import Link from "next/link";
import Image from "next/image";
import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { highlightParts } from "@/lib/highlight";
import type { Product } from "@/lib/types";
import { usePathname, useRouter } from "next/navigation";
import { useCart } from "./cart-provider";

export function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const [darkHeader, setDarkHeader] = useState(false);
  const [search, setSearch] = useState("");
  const { count, setOpen } = useCart();
  const [results, setResults] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [panelOpen, setPanelOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [searching, setSearching] = useState(false);
  const searchBox = useRef<HTMLFormElement>(null);
  const term = search.trim();
  const isAdmin = pathname.startsWith("/admin");

  useEffect(() => {
    const check = () => setDarkHeader(window.scrollY > 260);
    check();
    window.addEventListener("scroll", check, { passive: true });
    return () => window.removeEventListener("scroll", check);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setSearch(params.get("q") ?? "");
  }, []);

  // resultados en vivo mientras se escribe (con una pequeña espera para no pedir en cada tecla)
  useEffect(() => {
    if (term.length < 2) { setResults([]); setTotal(0); setSearching(false); return; }
    const controller = new AbortController();
    setSearching(true);
    const timer = setTimeout(() => {
      fetch(`/api/products?q=${encodeURIComponent(term)}`, { signal: controller.signal })
        .then((response) => response.json())
        .then((data: { items?: Product[]; total?: number }) => { setResults((data.items ?? []).slice(0, 6)); setTotal(data.total ?? 0); setActive(-1); })
        .catch(() => { /* cancelado o sin conexión: se deja la lista anterior */ })
        .finally(() => { if (!controller.signal.aborted) setSearching(false); });
    }, 220);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [term]);

  useEffect(() => {
    const close = (event: MouseEvent) => { if (!searchBox.current?.contains(event.target as Node)) setPanelOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const go = (href: string) => { setPanelOpen(false); router.push(href); };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") { setPanelOpen(false); return; }
    if (!panelOpen || results.length === 0) return;
    if (event.key === "ArrowDown") { event.preventDefault(); setActive((current) => (current + 1) % results.length); }
    if (event.key === "ArrowUp") { event.preventDefault(); setActive((current) => (current <= 0 ? results.length - 1 : current - 1)); }
    if (event.key === "Enter" && active >= 0) { event.preventDefault(); go(`/productos/${results[active].id}`); }
  };

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPanelOpen(false);
    const value = search.trim();
    router.push(value ? `/catalogo?q=${encodeURIComponent(value)}` : "/catalogo");
  };

  return (
    <header className={darkHeader ? "header-dark" : "header-red"}>
      <Link href="/" className="brand" aria-label="Electronorte Outlet">
        <Image
          src={darkHeader ? "/electronorte-white-red.png" : "/electronorte-white.png"}
          width={170}
          height={59}
          priority
          alt="Electronorte"
        />
        <small>OUTLET</small>
      </Link>

      {isAdmin ? (
        <nav>
          <Link href="/">Volver a la tienda</Link>
        </nav>
      ) : (
        <>
          <form className="header-search" onSubmit={submitSearch} ref={searchBox} role="search">
            <label className="sr-only" htmlFor="header-search">
              Buscar productos
            </label>
            <input
              id="header-search"
              className="header-search-input"
              type="search"
              placeholder="Buscar productos, marcas y categorías"
              value={search}
              onChange={(event) => { setSearch(event.target.value); setPanelOpen(true); }}
              onFocus={() => setPanelOpen(true)}
              onKeyDown={onKeyDown}
              autoComplete="off"
              role="combobox"
              aria-expanded={panelOpen && term.length >= 2}
              aria-controls="search-suggestions"
              aria-autocomplete="list"
            />
            <button type="submit" className="header-search-button">
              Buscar
            </button>
            {panelOpen && term.length >= 2 ? <div className="search-suggestions" id="search-suggestions" role="listbox">
              {results.length === 0 ? <p className="search-empty">{searching ? "Buscando…" : `No encontramos resultados para “${term}”.`}</p> : <>
                {results.map((product, index) => {
                  const thumb = (product.images?.[0] ?? product.image) || "";
                  return <a key={product.id} href={`/productos/${product.id}`} role="option" aria-selected={index === active} className={index === active ? "active" : ""}
                    onMouseEnter={() => setActive(index)} onClick={(event) => { event.preventDefault(); go(`/productos/${product.id}`); }}>
                    <span className="suggest-thumb">{/^https?:|^\//.test(thumb) ? <img src={thumb} alt="" width={40} height={40} loading="lazy" /> : null}</span>
                    <span className="suggest-text">
                      <b>{highlightParts(product.name, term).map((part, i) => part.match ? <mark key={i}>{part.text}</mark> : part.text)}</b>
                      <small>{[product.brand, product.category].filter(Boolean).join(" · ")}</small>
                    </span>
                    <span className="suggest-price">${Math.round(product.cashPrice).toLocaleString("es-AR")}</span>
                  </a>;
                })}
                <a className="search-all" href={`/catalogo?q=${encodeURIComponent(term)}`} onClick={(event) => { event.preventDefault(); go(`/catalogo?q=${encodeURIComponent(term)}`); }}>Ver los {total} resultados</a>
              </>}
            </div> : null}
          </form>

          <nav>
            <Link href="/catalogo">Productos</Link>
            <Link href="/catalogo?outlet=1">Outlet</Link>
            <Link href="/promos-bancarias">Promos bancarias</Link>
            <button type="button" className="cart-trigger" onClick={() => setOpen(true)} aria-label={`Ver pedido (${count} artículos)`}>Mi pedido{count > 0 ? <span className="cart-badge">{count}</span> : null}</button>
          </nav>
        </>
      )}
    </header>
  );
}
