"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { addLine, cartCount, CartLine, parseStoredCart, removeLine, setQty } from "@/lib/cart";
import type { Product } from "@/lib/types";

const STORAGE_KEY = "electronorte-pedido";

type CartContextValue = {
  lines: CartLine[];
  products: Map<string, Product>;
  loading: boolean;
  count: number;
  open: boolean;
  setOpen: (open: boolean) => void;
  add: (id: string) => void;
  changeQty: (id: string, qty: number) => void;
  remove: (id: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [products, setProducts] = useState<Map<string, Product>>(new Map());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try { setLines(parseStoredCart(localStorage.getItem(STORAGE_KEY))); } catch { /* sin almacenamiento */ }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(lines)); } catch { /* sin almacenamiento */ }
  }, [lines, ready]);

  const idsKey = lines.map((line) => line.id).join(",");
  useEffect(() => {
    if (!open || !idsKey) return;
    const controller = new AbortController();
    setLoading(true);
    fetch(`/api/products?ids=${idsKey}`, { signal: controller.signal })
      .then((response) => response.json())
      .then((data: { items?: Product[] }) => {
        const found = new Map((data.items ?? []).map((product) => [product.id, product]));
        setProducts(found);
        // artículos dados de baja desaparecen del pedido
        setLines((current) => current.filter((line) => found.has(line.id)));
      })
      .catch(() => { /* si falla se muestra vacío y se reintenta al reabrir */ })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [open, idsKey]);

  const add = useCallback((id: string) => setLines((current) => addLine(current, id)), []);
  const changeQty = useCallback((id: string, qty: number) => setLines((current) => setQty(current, id, qty)), []);
  const remove = useCallback((id: string) => setLines((current) => removeLine(current, id)), []);
  const clear = useCallback(() => setLines([]), []);

  const value = useMemo(() => ({ lines, products, loading, count: cartCount(lines), open, setOpen, add, changeQty, remove, clear }), [lines, products, loading, open, add, changeQty, remove, clear]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart debe usarse dentro de CartProvider");
  return context;
}
