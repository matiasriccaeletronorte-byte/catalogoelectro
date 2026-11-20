export type CategoryNodeData = { id: string; name: string; slug: string; parentId: string | null };
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
  return clean.length >= 2 && clean.length <= 60;
}

const isOthers = (name: string) => normalizeName(name) === "otros";

/** Orden alfabético en español; "Otros" siempre al final. */
export function compareNames(a: string, b: string): number {
  if (isOthers(a) !== isOthers(b)) return isOthers(a) ? 1 : -1;
  return collator.compare(a, b);
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
    .sort((a, b) => compareNames(a.name, b.name))
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

/** Todos los descendientes de un nodo, sin incluir el propio nodo. */
export function descendantIds(nodes: CategoryNodeData[], id: string): string[] {
  const children = new Map<string, string[]>();
  for (const node of nodes) if (node.parentId) children.set(node.parentId, [...(children.get(node.parentId) ?? []), node.id]);
  const out: string[] = [];
  const stack = [...(children.get(id) ?? [])];
  while (stack.length > 0) {
    const next = stack.pop()!;
    out.push(next);
    stack.push(...(children.get(next) ?? []));
  }
  return out;
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
    .sort((a, b) => compareNames(a.name, b.name))
    .map((node) => ({ id: node.id, name: node.name, slug: node.slug, count: counts[node.id] }));
}

/** Dirección nueva para un enlace viejo `?category=X&subCategory=Y`. `null` si la categoría ya no existe. */
export function legacyCategoryHref(nodes: CategoryNodeData[], category: string, subCategory = ""): string | null {
  const root = category.trim() ? findByName(nodes, null, category) : null;
  if (!root) return null;
  const sub = subCategory.trim() ? findByName(nodes, root.id, subCategory) : null;
  return categoryHref(nodePath(nodes, (sub ?? root).id));
}
