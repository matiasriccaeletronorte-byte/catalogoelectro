"use client";

import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { CartItem, Product } from "@/lib/types";

type CartContextValue = {
  items: CartItem[];
  add: (product: Product) => void;
  remove: (id: string) => void;
  clear: () => void;
  total: number;
  quantity: number;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  useEffect(() => {
    try {
      const stored = localStorage.getItem("electronorte-cart");
      setItems(stored ? JSON.parse(stored) : []);
    } catch {
      setItems([]);
    }
  }, []);
  useEffect(() => { localStorage.setItem("electronorte-cart", JSON.stringify(items)); }, [items]);
  const value = useMemo(() => ({
    items,
    add: (product: Product) => setItems(current => {
      const found = current.find(item => item.id === product.id);
      return found ? current.map(item => item.id === product.id ? { ...item, quantity: Math.min(item.quantity + 1, product.stock) } : item) : [...current, { ...product, quantity: 1 }];
    }),
    remove: (id: string) => setItems(current => current.filter(item => item.id !== id)),
    clear: () => setItems([]),
    total: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    quantity: items.reduce((sum, item) => sum + item.quantity, 0)
  }), [items]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart debe usarse dentro de CartProvider");
  return context;
}
