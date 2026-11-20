import { parsePathText } from "@/lib/category-tree";

/** Nombres del camino de una fila del Excel: "A > B > C", o categoría y subcategoría en columnas separadas. `null` si la fila no trae categoría. */
export function importPathNames(data: { category?: string; subCategory?: string }): string[] | null {
  if (data.category === undefined) return null;
  const names = parsePathText(data.category);
  if (names.length > 0 && !data.category.includes(">") && data.subCategory) names.push(...parsePathText(data.subCategory));
  return names;
}
