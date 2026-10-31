"use client";

import Link from "next/link";
import Image from "next/image";
import { FormEvent, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useCart } from "./cart-provider";

export function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const [darkHeader, setDarkHeader] = useState(false);
  const [search, setSearch] = useState("");
  const { count, setOpen } = useCart();
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

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
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
          <form className="header-search" onSubmit={submitSearch}>
            <label className="sr-only" htmlFor="header-search">
              Buscar productos
            </label>
            <input
              id="header-search"
              className="header-search-input"
              type="search"
              placeholder="Buscar productos, marcas y categorías"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <button type="submit" className="header-search-button">
              Buscar
            </button>
          </form>

          <nav>
            <Link href="/catalogo">Productos</Link>
            <Link href="/promos-bancarias">Promos bancarias</Link>
            <button type="button" className="cart-trigger" onClick={() => setOpen(true)} aria-label={`Ver pedido (${count} artículos)`}>Mi pedido{count > 0 ? <span className="cart-badge">{count}</span> : null}</button>
          </nav>
        </>
      )}
    </header>
  );
}
