export type DiscountType = "percent" | "amount";

/** Precio en efectivo = contado menos el descuento (en % o en $). Redondea a pesos enteros y nunca baja de 0. */
export function cashFromDiscount(listPrice: number, type: DiscountType, value: number): number {
  if (!(listPrice > 0) || !(value > 0)) return Math.max(0, Math.round(listPrice || 0));
  const discount = type === "percent" ? (listPrice * Math.min(value, 100)) / 100 : value;
  return Math.max(0, Math.round(listPrice - discount));
}

/** Cuánto descuento representa un par de precios (para mostrarlo al editar un artículo existente). */
export function impliedDiscount(listPrice: number, cashPrice: number): { amount: number; percent: number } | null {
  if (!(listPrice > 0) || !(cashPrice > 0) || cashPrice >= listPrice) return null;
  const amount = listPrice - cashPrice;
  return { amount, percent: Math.round((amount / listPrice) * 1000) / 10 };
}
