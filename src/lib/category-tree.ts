export type CategoryNodeData = { id: string; name: string; slug: string; parentId: string | null; order?: number };
export type TreeNode = CategoryNodeData & { children: TreeNode[] };
export type MenuNode = { id: string; name: string; href: string; count: number; children: MenuNode[] };

const collator = new Intl.Collator("es", { sensitivity: "base" });

/** Sin tildes, en minúsculas y con espacios colapsados: sirve para comparar nombres. */
export function normalizeName(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

export function slugify(name: string): string {
  const slug = normalizeName(name).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug || "categoria";
}

export function uniqueSlug(base: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  if (!used.has(base)) return base;
  for (let n = 2; ; n++) if (!used.has(`${base}-${n}`)) return `${base}-${n}`;
}

export function validCategoryName(name: string): boolean {
  const clean = name.replace(/\s+/g, " ").trim();
  // el ">" separa los niveles en el Excel: un nombre con ">" se partiría en varias categorías al reimportar
  return clean.length >= 2 && clean.length <= 60 && !clean.includes(">");
}

const isOthers = (name: string) => normalizeName(name) === "otros";

/** Orden alfabético en español; "Otros" siempre al final. */
export function compareNames(a: string, b: string): number {
  if (isOthers(a) !== isOthers(b)) return isOthers(a) ? 1 : -1;
  return collator.compare(a, b);
}

/** Orden de las categorías hermanas: primero las que tienen orden manual (por su posición) y después las demás, de la A a la Z ("Otros" al final). */
export function compareNodes(a: CategoryNodeData, b: CategoryNodeData): number {
  const hasA = typeof a.order === "number", hasB = typeof b.order === "number";
  if (hasA && hasB) return (a.order as number) - (b.order as number);
  if (hasA !== hasB) return hasA ? -1 : 1;
  return compareNames(a.name, b.name);
}

/** Ids de los hermanos de `id` (en su orden actual) después de ponerlo antes de `beforeId`, o al final si es `null`. `null` si alguno no existe o no son hermanos. */
export function moveBefore(nodes: CategoryNodeData[], id: string, beforeId: string | null): string[] | null {
  const node = nodes.find((item) => item.id === id);
  if (!node) return null;
  const siblings = nodes.filter((item) => item.parentId === node.parentId).sort(compareNodes).map((item) => item.id);
  if (beforeId !== null && !siblings.includes(beforeId)) return null;
  const rest = siblings.filter((item) => item !== id);
  const at = beforeId === null ? rest.length : rest.indexOf(beforeId);
  if (at === -1) return siblings; // soltarlo sobre sí mismo
  rest.splice(at, 0, id);
  return rest;
}

/** Ordena elementos que llevan el nombre de un grupo principal (por ejemplo, la franja de la portada) según el orden del árbol. Los que no están en el árbol van al final, con el orden que traían. */
export function orderByRoots<T extends { name: string }>(items: T[], nodes: CategoryNodeData[]): T[] {
  const roots = nodes.filter((node) => node.parentId === null).sort(compareNodes);
  const position = new Map(roots.map((node, index) => [normalizeName(node.name), index]));
  const at = (item: T) => position.get(normalizeName(item.name)) ?? Number.MAX_SAFE_INTEGER;
  return items.map((item, index) => ({ item, index })).sort((a, b) => at(a.item) - at(b.item) || a.index - b.index).map(({ item }) => item);
}

export function buildTree(nodes: CategoryNodeData[]): TreeNode[] {
  const byParent = new Map<string | null, CategoryNodeData[]>();
  for (const node of nodes) {
    const list = byParent.get(node.parentId) ?? [];
    list.push(node);
    byParent.set(node.parentId, list);
  }
  const build = (parentId: string | null, depth: number): TreeNode[] => depth > 50 ? [] : (byParent.get(parentId) ?? [])
    .slice()
    .sort(compareNodes)
    .map((node) => ({ ...node, children: build(node.id, depth + 1) }));
  return build(null, 0);
}

/** Camino de la raíz al nodo (incluido). `[]` si el nodo no existe. */
export function nodePath(nodes: CategoryNodeData[], id: string): CategoryNodeData[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const path: CategoryNodeData[] = [];
  let current = byId.get(id);
  while (current && path.length < 50) {
    path.unshift(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return path;
}

/** Todos los descendientes de un nodo, sin incluir el propio nodo. Tolera datos con ciclos (no se queda dando vueltas). */
export function descendantIds(nodes: CategoryNodeData[], id: string): string[] {
  const children = new Map<string, string[]>();
  for (const node of nodes) if (node.parentId) children.set(node.parentId, [...(children.get(node.parentId) ?? []), node.id]);
  const seen = new Set<string>([id]);
  const out: string[] = [];
  const stack = [...(children.get(id) ?? [])];
  while (stack.length > 0) {
    const next = stack.pop()!;
    if (seen.has(next)) continue;
    seen.add(next);
    out.push(next);
    stack.push(...(children.get(next) ?? []));
  }
  return out;
}

/** El nodo es su propio ancestro (por ejemplo, dos personas mueven categorías a la vez). */
export function hasCycle(nodes: CategoryNodeData[], id: string): boolean {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const seen = new Set<string>();
  let current = byId.get(id);
  while (current && current.parentId) {
    if (seen.has(current.id)) return true;
    seen.add(current.id);
    current = byId.get(current.parentId);
    if (current && current.id === id) return true;
  }
  return false;
}

/** Se puede mover un nodo a otro padre (o a primer nivel con `null`) mientras no sea dentro de sí mismo ni de sus descendientes. */
export function canMove(nodes: CategoryNodeData[], id: string, newParentId: string | null): boolean {
  if (!nodes.some((node) => node.id === id)) return false;
  if (newParentId === null) return true;
  if (newParentId === id) return false;
  if (!nodes.some((node) => node.id === newParentId)) return false;
  return !descendantIds(nodes, id).includes(newParentId);
}

export function resolveSlugs(nodes: CategoryNodeData[], slugs: string[]): CategoryNodeData | null {
  let parent: string | null = null;
  let found: CategoryNodeData | null = null;
  for (const slug of slugs) {
    found = nodes.find((node) => node.parentId === parent && node.slug === slug) ?? null;
    if (!found) return null;
    parent = found.id;
  }
  return found;
}

export function findByName(nodes: CategoryNodeData[], parentId: string | null, name: string): CategoryNodeData | null {
  const key = normalizeName(name);
  return nodes.find((node) => node.parentId === parentId && normalizeName(node.name) === key) ?? null;
}

export const formatPath = (path: { name: string }[]): string => path.map((node) => node.name).join(" > ");

/** "A >  > B" → ["A", "B"]: separa por ">", colapsa espacios y descarta los vacíos. */
export function parsePathText(text: string): string[] {
  return text.split(">").map((part) => part.replace(/\s+/g, " ").trim()).filter(Boolean);
}

export const categoryHref = (path: { slug: string }[]): string => (path.length > 0 ? `/catalogo/${path.map((node) => node.slug).join("/")}` : "/catalogo");

/** Copias derivadas que conserva cada artículo: nombre del nivel 1 y del nivel 2. */
export function derivedFields(path: { name: string }[]): { category: string; subCategory: string } {
  return { category: path[0]?.name ?? "", subCategory: path[1]?.name ?? "" };
}

/** Categorías (con su camino completo en texto) que no existen todavía, una sola vez cada una. */
export function missingPaths(nodes: CategoryNodeData[], paths: string[][]): string[] {
  const key = (names: string[]) => names.map(normalizeName).join(">");
  const existing = new Set(nodes.map((node) => key(nodePath(nodes, node.id).map((part) => part.name))));
  const missing = new Map<string, string>();
  for (const names of paths) {
    for (let length = 1; length <= names.length; length++) {
      const prefix = names.slice(0, length);
      const k = key(prefix);
      if (!existing.has(k) && !missing.has(k)) missing.set(k, prefix.join(" > "));
    }
  }
  return [...missing.values()];
}

/** Árbol para el menú: solo categorías con artículos (`counts` incluye a los descendientes), hasta `maxDepth` niveles. */
export function buildMenuTree(nodes: CategoryNodeData[], counts: Record<string, number>, maxDepth = 3): MenuNode[] {
  const make = (tree: TreeNode, depth: number): MenuNode | null => {
    const count = counts[tree.id] ?? 0;
    if (count <= 0) return null;
    const children = depth < maxDepth ? tree.children.map((child) => make(child, depth + 1)).filter((child): child is MenuNode => child !== null) : [];
    return { id: tree.id, name: tree.name, href: categoryHref(nodePath(nodes, tree.id)), count, children };
  };
  return buildTree(nodes).map((tree) => make(tree, 1)).filter((node): node is MenuNode => node !== null);
}

/** Camino en texto (`A > B > C`) de un artículo: del árbol si está convertido; si no, de sus copias category y subCategory. */
export function productPathText(nodes: CategoryNodeData[], product: { categoryId?: unknown; category?: string; subCategory?: string }): string {
  const fromTree = product.categoryId ? nodePath(nodes, String(product.categoryId)) : [];
  if (fromTree.length > 0) return formatPath(fromTree);
  return [product.category, product.subCategory].filter(Boolean).join(" > ");
}

export type CategoryChild = { id: string; name: string; slug: string; count: number };

/** Subcategorías directas de un nodo (o categorías de primer nivel con `null`) que tienen artículos, con su cantidad. */
export function childrenWithCounts(nodes: CategoryNodeData[], parentId: string | null, counts: Record<string, number>): CategoryChild[] {
  return nodes
    .filter((node) => node.parentId === parentId && (counts[node.id] ?? 0) > 0)
    .sort(compareNodes)
    .map((node) => ({ id: node.id, name: node.name, slug: node.slug, count: counts[node.id] }));
}

/** Categoría que se llama así en cualquier nivel del árbol, solo si hay una única (si el nombre se repite en distintas ramas, no se adivina). */
export function findUniqueByName(nodes: CategoryNodeData[], name: string): CategoryNodeData | null {
  const key = normalizeName(name);
  const matches = nodes.filter((node) => normalizeName(node.name) === key);
  return matches.length === 1 ? matches[0] : null;
}

/** Categoría con esa dirección en cualquier nivel, solo si es única. Sirve para direcciones viejas que pasaron a un nivel más profundo. */
export function findUniqueBySlug(nodes: CategoryNodeData[], slug: string): CategoryNodeData | null {
  const matches = nodes.filter((node) => node.slug === slug);
  return matches.length === 1 ? matches[0] : null;
}

/** Dirección nueva para un enlace viejo `?category=X&subCategory=Y`. Busca primero entre las de primer nivel y, si no está, en cualquier nivel. `null` si ya no existe o es ambigua. */
export function legacyCategoryHref(nodes: CategoryNodeData[], category: string, subCategory = ""): string | null {
  if (!category.trim()) return null;
  const root = findByName(nodes, null, category) ?? findUniqueByName(nodes, category);
  if (!root) return null;
  const sub = subCategory.trim() ? findByName(nodes, root.id, subCategory) : null;
  return categoryHref(nodePath(nodes, (sub ?? root).id));
}
