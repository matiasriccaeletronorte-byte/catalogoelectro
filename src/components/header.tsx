"use client";

import Link from "next/link";
import Image from "next/image";
import { useCart } from "./cart-provider";
import { FormEvent, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

type Customer = { id: string; name: string; email: string; picture: string };

export function Header() {
  const { quantity } = useCart();
  const router = useRouter();
  const pathname = usePathname();
  const [darkHeader, setDarkHeader] = useState(false);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [search, setSearch] = useState("");
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

  useEffect(() => {
    fetch("/api/auth/customer/me")
      .then((r) => r.json())
      .then((data) => setCustomer(data.authenticated ? data.customer : null));
  }, []);

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = search.trim();
    router.push(value ? `/?q=${encodeURIComponent(value)}#catalogo` : "/#catalogo");
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
            <Link href="/#catalogo">Productos</Link>
            {customer ? <Link href="/account">Mi cuenta</Link> : <Link href="/api/auth/customer/google/start?returnTo=/account">Ingresar</Link>}
            <Link href="/checkout" className="cart">
              Carrito <b>{quantity}</b>
            </Link>
          </nav>
        </>
      )}
    </header>
  );
}
