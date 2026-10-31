"use client";

import { useState } from "react";
import { useCart } from "./cart-provider";

export function AddToCartButton({ productId, className = "add-cart-button" }: { productId: string; className?: string }) {
  const { add } = useCart();
  const [added, setAdded] = useState(false);
  return <button type="button" className={className} onClick={() => {
    add(productId);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  }}>{added ? "✓ Agregado" : "Agregar al pedido"}</button>;
}
