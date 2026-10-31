import type { Product } from "./types";

export type CartLine = { id: string; qty: number };

export const MAX_CART_LINES = 40;
export const MAX_QTY = 99;

export function addLine(lines: CartLine[], id: string, qty = 1): CartLine[] {
  const found = lines.find((line) => line.id === id);
  if (found) return lines.map((line) => (line.id === id ? { ...line, qty: Math.min(line.qty + qty, MAX_QTY) } : line));
  if (lines.length >= MAX_CART_LINES) return lines;
  return [...lines, { id, qty: Math.min(qty, MAX_QTY) }];
}

export function setQty(lines: CartLine[], id: string, qty: number): CartLine[] {
  if (qty <= 0) return removeLine(lines, id);
  return lines.map((line) => (line.id === id ? { ...line, qty: Math.min(Math.floor(qty), MAX_QTY) } : line));
}

export function removeLine(lines: CartLine[], id: string): CartLine[] {
  return lines.filter((line) => line.id !== id);
}

export function cartCount(lines: CartLine[]): number {
  return lines.reduce((sum, line) => sum + line.qty, 0);
}

export function parseStoredCart(raw: string | null): CartLine[] {
  try {
    const data = JSON.parse(raw ?? "[]");
    if (!Array.isArray(data)) return [];
    return data
      .filter((line) => line && typeof line.id === "string" && Number.isInteger(line.qty) && line.qty > 0)
      .slice(0, MAX_CART_LINES)
      .map((line) => ({ id: line.id, qty: Math.min(line.qty, MAX_QTY) }));
  } catch {
    return [];
  }
}

export function cartTotals(lines: CartLine[], products: Map<string, Product>) {
  let cash = 0;
  let list = 0;
  for (const line of lines) {
    const product = products.get(line.id);
    if (!product) continue;
    cash += product.cashPrice * line.qty;
    list += product.listPrice * line.qty;
  }
  return { cash, list };
}

const money = (value: number) => `$${Math.round(value).toLocaleString("es-AR")}`;

export function buildCartMessage(lines: CartLine[], products: Map<string, Product>, origin: string): string {
  const rows = lines.filter((line) => products.has(line.id)).map((line) => {
    const p = products.get(line.id)!;
    const sku = p.sku ? ` (código ${p.sku})` : "";
    return `• ${line.qty} x ${p.name}${sku}\n  Efectivo ${money(p.cashPrice)} · Contado ${money(p.listPrice)} c/u\n  ${origin}/productos/${p.id}`;
  });
  const totals = cartTotals(lines, products);
  return [
    "Hola, quiero consultar por este pedido:",
    "",
    ...rows,
    "",
    `Total en efectivo: ${money(totals.cash)}`,
    `Total de contado: ${money(totals.list)}`,
    "Precios sujetos a confirmación."
  ].join("\n");
}

export function buildCartUrl(phone: string, message: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}` : "";
}
