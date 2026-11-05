"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { normalizeCode, type PublicCoupon } from "@/lib/coupons";
import { addLine, cartCount, CartLine, parseStoredCart, removeLine, setQty } from "@/lib/cart";
import type { Product } from "@/lib/types";

const STORAGE_KEY = "electronorte-pedido";
const COUPON_KEY = "electronorte-cupon";

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
  coupon: PublicCoupon | null;
  couponError: string;
  applyCoupon: (code: string) => Promise<void>;
  removeCoupon: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [products, setProducts] = useState<Map<string, Product>>(new Map());
  const [loading, setLoading] = useState(false);
  const [coupon, setCoupon] = useState<PublicCoupon | null>(null);
  const [couponError, setCouponError] = useState("");

  useEffect(() => {
    try { setLines(parseStoredCart(localStorage.getItem(STORAGE_KEY))); } catch { /* sin almacenamiento */ }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(lines)); } catch { /* sin almacenamiento */ }
  }, [lines, ready]);

  const checkCoupon = useCallback(async (raw: string, remember: boolean) => {
    const code = normalizeCode(raw);
    if (!code) return;
    try {
      const response = await fetch(`/api/coupons?code=${encodeURIComponent(code)}`, { cache: "no-store" });
      if (!response.ok) {
        setCoupon(null);
        setCouponError((await response.json().catch(() => ({}))).error ?? "Cupón inválido o vencido.");
        try { localStorage.removeItem(COUPON_KEY); } catch { /* sin almacenamiento */ }
        return;
      }
      setCoupon(await response.json());
      setCouponError("");
      if (remember) try { localStorage.setItem(COUPON_KEY, code); } catch { /* sin almacenamiento */ }
    } catch {
      setCouponError("No se pudo validar el cupón. Probá de nuevo.");
    }
  }, []);

  // al abrir el pedido se vuelve a validar el cupón guardado (puede haber vencido)
  useEffect(() => {
    if (!open) return;
    let saved = "";
    try { saved = localStorage.getItem(COUPON_KEY) ?? ""; } catch { /* sin almacenamiento */ }
    if (saved) void checkCoupon(saved, false);
  }, [open, checkCoupon]);

  const applyCoupon = useCallback((code: string) => checkCoupon(code, true), [checkCoupon]);
  const removeCoupon = useCallback(() => {
    setCoupon(null);
    setCouponError("");
    try { localStorage.removeItem(COUPON_KEY); } catch { /* sin almacenamiento */ }
  }, []);

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

  const value = useMemo(() => ({ lines, products, loading, count: cartCount(lines), open, setOpen, add, changeQty, remove, clear, coupon, couponError, applyCoupon, removeCoupon }), [lines, products, loading, open, add, changeQty, remove, clear, coupon, couponError, applyCoupon, removeCoupon]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart debe usarse dentro de CartProvider");
  return context;
}
