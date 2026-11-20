# Categorías en varios niveles: plan de implementación

> **Para quien ejecute este plan:** usar superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans, tarea por tarea. Los pasos usan casillas `- [ ]` para llevar el avance.

**Objetivo:** reemplazar `category`/`subCategory` (dos niveles) por un árbol de categorías sin límite de niveles, administrable desde el panel, con direcciones por camino, importación/exportación con caminos y un menú "Categorías" por niveles.

**Arquitectura:** cada categoría es un documento (`CategoryNode`, con padre). Cada artículo guarda `categoryId` (su nodo) y `categoryPath` (ids de la raíz al nodo) para buscar "todo lo de una rama". `category` y `subCategory` siguen existiendo como **copias derivadas** (nivel 1 y nivel 2) para no romper el resto del código. La lógica del árbol es pura y con tests (`category-tree.ts`); las operaciones con la base van en `category-store.ts`.

**Tecnologías:** Next.js 15 (App Router) + React 19, Mongoose 8, Zod, TypeScript, Vitest, ExcelJS. Base local: contenedor Docker `mongo-catalogo` (puerto 27017).

**Spec:** `docs/superpowers/specs/2026-11-19-categorias-multinivel-design.md`

## Global Constraints

- **No cambiar la paleta de colores.** Usar los tokens existentes (`--brand`, `--line`, `--muted`, `--text`, `#E52627`). Nada de colores de marca nuevos.
- Toda la interfaz en español rioplatense (voseo: "elegí", "borrá", "movelas").
- Árbol sin límite técnico de niveles; el menú muestra hasta 3 niveles.
- Un artículo pertenece a **una** categoría (cualquier nodo, no solo hojas).
- Orden: alfabético (español, sin distinguir tildes ni mayúsculas) y "Otros" siempre al final de su nivel.
- Separador de caminos en texto: `>` (los nombres pueden contener `/`). Formato `A > B > C`.
- Nombre de categoría: entre 2 y 60 caracteres, espacios colapsados.
- Dirección por camino: `/catalogo/climatizacion/aires-acondicionados/split`. Los enlaces viejos `/catalogo?category=…` redirigen con 308.
- Borrar una categoría solo si no tiene subcategorías ni artículos (respuesta 409 con el motivo).
- Categorías sin artículos no aparecen en el menú, el mapa del sitio ni la tira de la home.
- **No tocar** la carpeta original `/home/mati/Escritorio/Proyectos electronorte/eccomerce (1)/eccomerce`. Trabajar en `catalogo-electronorte` (el directorio de trabajo vuelve al original: hacer siempre `cd "/home/mati/Escritorio/Proyectos electronorte/catalogo-electronorte"`).
- **No acceder a la base de producción** ni pedir claves. Producción se actualiza con el `git push` que hace el usuario y la importación del Excel desde el admin.
- Cada commit termina con la línea: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Pruebas con base: `docker start mongo-catalogo` y `MONGODB_TEST_URI` por defecto `mongodb://localhost:27017/catalogo_test` (las pruebas se omiten solas si no hay Mongo, **pero hay que correrlas con Mongo encendido**).
- No hacer `pkill -f "next dev"` (mata la propia terminal). El servidor local se levanta con `npm run dev` (puerto 3000) y se reinicia buscando el pid con `ss -ltnp | grep :3000`.

## Review Focus

Entradas que el spec no detalla y que más probablemente rompan algo; cada una tiene su prueba en la tarea que se indica:

1. **Nombres con tildes, mayúsculas o espacios dobles** ("Climatización", "climatizacion ", "CLIMATIZACIÓN  ") deben ser **un solo** nodo, en el admin y en el Excel. (Tareas 1, 3 y 7)
2. **Mover una categoría dentro de sí misma o de una de sus subcategorías** se rechaza y no cambia nada. (Tareas 1, 3 y 4)
3. **Borrar una categoría con artículos o con subcategorías** se bloquea (409) sin perder artículos. (Tarea 3)
4. **Enlaces viejos** `?category=` con otras tildes/mayúsculas, con un nombre que ya no existe, y **caminos inexistentes** (`/catalogo/no-existe`): redirigen, muestran el catálogo con el filtro viejo, o dan 404, nunca error 500. (Tarea 11)
5. **Filas de Excel con caminos raros** (`A >  > B`, solo `>`, segmentos de 1 carácter o de más de 60) dan error de fila claro o ignoran los vacíos; nunca crean categorías vacías ni duplicadas. (Tarea 7)
6. **Artículos sin convertir** (sin `categoryId`) siguen apareciendo en el catálogo mientras no se convierta. (Tareas 6 y 11)

---

# ETAPA 1: Núcleo (árbol, migración, admin)

### Task 1: Lógica pura del árbol

**Files:**
- Create: `src/lib/category-tree.ts`
- Test: `src/lib/category-tree.test.ts`

**Interfaces:**
- Produces (todo exportado desde `src/lib/category-tree.ts`):
  - `type CategoryNodeData = { id: string; name: string; slug: string; parentId: string | null }`
  - `type TreeNode = CategoryNodeData & { children: TreeNode[] }`
  - `type MenuNode = { id: string; name: string; href: string; count: number; children: MenuNode[] }`
  - `normalizeName(text: string): string`
  - `slugify(name: string): string`
  - `uniqueSlug(base: string, taken: Iterable<string>): string`
  - `compareNames(a: string, b: string): number`
  - `validCategoryName(name: string): boolean` (2 a 60 caracteres ya con espacios colapsados)
  - `buildTree(nodes: CategoryNodeData[]): TreeNode[]`
  - `nodePath(nodes: CategoryNodeData[], id: string): CategoryNodeData[]` (de la raíz al nodo; `[]` si no existe)
  - `descendantIds(nodes: CategoryNodeData[], id: string): string[]` (sin incluir `id`)
  - `canMove(nodes: CategoryNodeData[], id: string, newParentId: string | null): boolean`
  - `resolveSlugs(nodes: CategoryNodeData[], slugs: string[]): CategoryNodeData | null`
  - `findByName(nodes: CategoryNodeData[], parentId: string | null, name: string): CategoryNodeData | null`
  - `formatPath(path: { name: string }[]): string`
  - `parsePathText(text: string): string[]`
  - `categoryHref(path: { slug: string }[]): string`
  - `derivedFields(path: { name: string }[]): { category: string; subCategory: string }`
  - `missingPaths(nodes: CategoryNodeData[], paths: string[][]): string[]`
  - `buildMenuTree(nodes: CategoryNodeData[], counts: Record<string, number>, maxDepth?: number): MenuNode[]`

- [ ] **Step 1: Escribir las pruebas que fallan**

Crear `src/lib/category-tree.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  buildMenuTree, buildTree, canMove, categoryHref, CategoryNodeData, derivedFields, descendantIds, findByName, formatPath,
  missingPaths, nodePath, normalizeName, parsePathText, resolveSlugs, slugify, uniqueSlug, validCategoryName
} from "./category-tree";

const n = (id: string, name: string, parentId: string | null = null, slug = slugify(name)): CategoryNodeData => ({ id, name, slug, parentId });
const sample = [
  n("1", "Climatización"),
  n("2", "Aires acondicionados", "1"),
  n("3", "Split", "2"),
  n("4", "Portátil", "2"),
  n("5", "Calefacción", "1"),
  n("6", "Hogar"),
  n("7", "Otros"),
  n("8", "Bazar", "6")
];

describe("normalizeName / slugify / uniqueSlug", () => {
  it("normaliza tildes, mayúsculas y espacios", () => {
    expect(normalizeName("  CLIMATIZACIÓN   Ñandú ")).toBe("climatizacion nandu");
  });
  it("arma la dirección sin tildes y con guiones", () => {
    expect(slugify("Aires acondicionados")).toBe("aires-acondicionados");
    expect(slugify("Jardín, playa y camping")).toBe("jardin-playa-y-camping");
  });
  it("un nombre que queda vacío usa 'categoria'", () => {
    expect(slugify("¡¡¡")).toBe("categoria");
  });
  it("si la dirección ya existe agrega -2, -3…", () => {
    expect(uniqueSlug("aires", [])).toBe("aires");
    expect(uniqueSlug("aires", ["aires"])).toBe("aires-2");
    expect(uniqueSlug("aires", ["aires", "aires-2"])).toBe("aires-3");
  });
});

describe("validCategoryName", () => {
  it("acepta de 2 a 60 caracteres", () => {
    expect(validCategoryName("TV")).toBe(true);
    expect(validCategoryName("x".repeat(60))).toBe(true);
  });
  it("rechaza muy corto o muy largo", () => {
    expect(validCategoryName("A")).toBe(false);
    expect(validCategoryName("")).toBe(false);
    expect(validCategoryName("x".repeat(61))).toBe(false);
  });
});

describe("buildTree", () => {
  it("ordena alfabético sin distinguir tildes y deja Otros al final", () => {
    const tree = buildTree([n("a", "Zapatos"), n("b", "Álamo"), n("c", "Otros"), n("d", "Bazar")]);
    expect(tree.map((t) => t.name)).toEqual(["Álamo", "Bazar", "Zapatos", "Otros"]);
  });
  it("arma los hijos", () => {
    const tree = buildTree(sample);
    expect(tree.map((t) => t.name)).toEqual(["Climatización", "Hogar", "Otros"]);
    expect(tree[0].children.map((c) => c.name)).toEqual(["Aires acondicionados", "Calefacción"]);
    expect(tree[0].children[0].children.map((c) => c.name)).toEqual(["Portátil", "Split"]);
  });
});

describe("nodePath / descendantIds", () => {
  it("camino de la raíz al nodo", () => {
    expect(nodePath(sample, "3").map((x) => x.name)).toEqual(["Climatización", "Aires acondicionados", "Split"]);
  });
  it("id inexistente da camino vacío", () => {
    expect(nodePath(sample, "999")).toEqual([]);
  });
  it("descendientes sin incluir el propio nodo", () => {
    expect(descendantIds(sample, "1").sort()).toEqual(["2", "3", "4", "5"]);
    expect(descendantIds(sample, "3")).toEqual([]);
  });
});

describe("canMove", () => {
  it("permite mover a otro padre o a primer nivel", () => {
    expect(canMove(sample, "5", "6")).toBe(true);
    expect(canMove(sample, "3", null)).toBe(true);
  });
  it("rechaza moverla dentro de sí misma", () => {
    expect(canMove(sample, "1", "1")).toBe(false);
  });
  it("rechaza moverla dentro de una subcategoría suya", () => {
    expect(canMove(sample, "1", "3")).toBe(false);
  });
  it("rechaza nodos o padres inexistentes", () => {
    expect(canMove(sample, "999", null)).toBe(false);
    expect(canMove(sample, "1", "999")).toBe(false);
  });
});

describe("resolveSlugs / findByName", () => {
  it("resuelve un camino de direcciones", () => {
    expect(resolveSlugs(sample, ["climatizacion", "aires-acondicionados", "split"])?.id).toBe("3");
  });
  it("camino inexistente o vacío da null", () => {
    expect(resolveSlugs(sample, ["climatizacion", "no-existe"])).toBeNull();
    expect(resolveSlugs(sample, [])).toBeNull();
  });
  it("una dirección de otro nivel no coincide", () => {
    expect(resolveSlugs(sample, ["split"])).toBeNull();
  });
  it("busca por nombre entre hermanos sin distinguir tildes ni mayúsculas", () => {
    expect(findByName(sample, null, "  CLIMATIZACION ")?.id).toBe("1");
    expect(findByName(sample, "1", "aires   acondicionados")?.id).toBe("2");
    expect(findByName(sample, "6", "Split")).toBeNull();
  });
});

describe("texto de caminos", () => {
  it("formatea y parsea", () => {
    expect(formatPath([{ name: "A" }, { name: "B" }])).toBe("A > B");
    expect(parsePathText("Climatización > Aires acondicionados >  Split ")).toEqual(["Climatización", "Aires acondicionados", "Split"]);
  });
  it("descarta segmentos vacíos y colapsa espacios", () => {
    expect(parsePathText("A >  > B")).toEqual(["A", "B"]);
    expect(parsePathText(">")).toEqual([]);
    expect(parsePathText("")).toEqual([]);
    expect(parsePathText("Portátil/Split")).toEqual(["Portátil/Split"]);
  });
});

describe("categoryHref / derivedFields", () => {
  it("arma la dirección", () => {
    expect(categoryHref([{ slug: "climatizacion" }, { slug: "aires" }])).toBe("/catalogo/climatizacion/aires");
    expect(categoryHref([])).toBe("/catalogo");
  });
  it("copias derivadas: nivel 1 y nivel 2", () => {
    expect(derivedFields([{ name: "A" }, { name: "B" }, { name: "C" }])).toEqual({ category: "A", subCategory: "B" });
    expect(derivedFields([{ name: "A" }])).toEqual({ category: "A", subCategory: "" });
    expect(derivedFields([])).toEqual({ category: "", subCategory: "" });
  });
});

describe("missingPaths", () => {
  it("lista cada categoría que falta, una sola vez", () => {
    const missing = missingPaths(sample, [
      ["climatizacion", "aires acondicionados", "Ventana"],
      ["Climatización", "Aires acondicionados", "Ventana"],
      ["Motos", "Eléctricas"]
    ]);
    expect(missing).toEqual(["climatizacion > aires acondicionados > Ventana", "Motos", "Motos > Eléctricas"]);
  });
  it("si todo existe no devuelve nada", () => {
    expect(missingPaths(sample, [["Climatización", "Calefacción"]])).toEqual([]);
  });
});

describe("buildMenuTree", () => {
  const counts = { "1": 10, "2": 6, "3": 4, "4": 0, "5": 4, "6": 0, "8": 0, "7": 3 };
  it("omite categorías sin artículos y arma los enlaces", () => {
    const menu = buildMenuTree(sample, counts);
    expect(menu.map((m) => m.name)).toEqual(["Climatización", "Otros"]);
    const aires = menu[0].children.find((c) => c.name === "Aires acondicionados")!;
    expect(aires.href).toBe("/catalogo/climatizacion/aires-acondicionados");
    expect(aires.children.map((c) => c.name)).toEqual(["Split"]);
  });
  it("respeta la profundidad máxima", () => {
    const menu = buildMenuTree(sample, counts, 2);
    expect(menu[0].children.find((c) => c.name === "Aires acondicionados")!.children).toEqual([]);
  });
});
```

- [ ] **Step 2: Correr las pruebas y ver que fallan**

Run: `cd "/home/mati/Escritorio/Proyectos electronorte/catalogo-electronorte" && npx vitest run src/lib/category-tree.test.ts`
Expected: FAIL (`Cannot find module './category-tree'`).

- [ ] **Step 3: Implementar**

Crear `src/lib/category-tree.ts`:

```ts
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
```

- [ ] **Step 4: Correr las pruebas y ver que pasan**

Run: `npx vitest run src/lib/category-tree.test.ts`
Expected: PASS (todas las pruebas del archivo).

- [ ] **Step 5: Commit**

```bash
git add src/lib/category-tree.ts src/lib/category-tree.test.ts
git commit -m "Categorías: lógica pura del árbol (caminos, direcciones, mover sin ciclos, menú)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Modelo `CategoryNode` y campos nuevos en `Product`

**Files:**
- Create: `src/models/CategoryNode.ts`
- Modify: `src/models/Product.ts`
- Modify: `src/lib/types.ts`
- Modify: `src/lib/catalog-query.ts` (función `toPublicProduct`)
- Test: `src/lib/catalog-query.test.ts` (crear)

**Interfaces:**
- Consumes: nada de tareas anteriores.
- Produces:
  - `CategoryNodeModel` (Mongoose) con campos `name`, `slug`, `nameKey`, `parentId` (ObjectId o `null`).
  - `Product` (Mongoose) con `categoryId: ObjectId | null` y `categoryPath: ObjectId[]`.
  - `Product` (tipo público en `types.ts`) con `categoryId?: string`.
  - `toPublicProduct(row)` ya **no** deja pasar `categoryPath` y convierte `categoryId` a texto (los ObjectId no se pueden pasar a componentes de pantalla).

- [ ] **Step 1: Escribir la prueba que falla**

Crear `src/lib/catalog-query.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { Types } from "mongoose";
import { toPublicProduct } from "./catalog-query";

describe("toPublicProduct", () => {
  const base = { _id: new Types.ObjectId(), name: "Aire", sku: "A1", category: "Climatización", subCategory: "Aires", cashPrice: 1, listPrice: 2, available: true, outlet: false, image: "", searchText: "x", stock: 3, active: true, __v: 0 };

  it("convierte el id y quita campos internos", () => {
    const out = toPublicProduct(base) as Record<string, unknown>;
    expect(out.id).toBe(String(base._id));
    expect(out).not.toHaveProperty("searchText");
    expect(out).not.toHaveProperty("_id");
  });

  it("categoryId sale como texto y categoryPath no sale", () => {
    const categoryId = new Types.ObjectId();
    const out = toPublicProduct({ ...base, categoryId, categoryPath: [new Types.ObjectId(), categoryId] }) as Record<string, unknown>;
    expect(out.categoryId).toBe(String(categoryId));
    expect(out).not.toHaveProperty("categoryPath");
  });

  it("sin categoryId no inventa el campo", () => {
    const out = toPublicProduct({ ...base, categoryId: null, categoryPath: [] }) as Record<string, unknown>;
    expect(out).not.toHaveProperty("categoryId");
  });

  it("el resultado se puede serializar a JSON sin ObjectId", () => {
    const categoryId = new Types.ObjectId();
    const json = JSON.stringify(toPublicProduct({ ...base, categoryId, categoryPath: [categoryId] }));
    expect(json).toContain(String(categoryId));
    expect(json).not.toContain("buffer");
  });
});
```

- [ ] **Step 2: Correr la prueba y ver que falla**

Run: `npx vitest run src/lib/catalog-query.test.ts`
Expected: FAIL (`categoryId` queda como ObjectId o `categoryPath` aparece).

- [ ] **Step 3: Implementar**

Crear `src/models/CategoryNode.ts`:

```ts
import { model, models, Schema } from "mongoose";

const categoryNodeSchema = new Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true },
  nameKey: { type: String, required: true },
  parentId: { type: Schema.Types.ObjectId, default: null }
}, { timestamps: true });

// no puede haber dos hermanos con la misma dirección ni con el mismo nombre (sin tildes ni mayúsculas)
categoryNodeSchema.index({ parentId: 1, slug: 1 }, { unique: true });
categoryNodeSchema.index({ parentId: 1, nameKey: 1 }, { unique: true });

export const CategoryNodeModel = models.CategoryNode || model("CategoryNode", categoryNodeSchema);
```

En `src/models/Product.ts`, dentro de `productSchema`, agregar después de la línea `subCategory: ...`:

```ts
  categoryId: { type: Schema.Types.ObjectId, default: null },
  categoryPath: { type: [Schema.Types.ObjectId], default: [] },
```

y debajo de los índices existentes (después de `productSchema.index({ active: 1, listPrice: 1 });`):

```ts
productSchema.index({ categoryPath: 1, active: 1 });
productSchema.index({ categoryId: 1 });
```

En `src/lib/types.ts`, agregar al tipo `Product` después de `subCategory?: string;`:

```ts
  categoryId?: string;
```

En `src/lib/catalog-query.ts`, reemplazar la función `toPublicProduct` completa por:

```ts
export function toPublicProduct(row: Record<string, unknown>): Product {
  const { _id, searchText, stock, active, createdAt, updatedAt, __v, categoryPath, categoryId, ...rest } = row;
  return { ...(rest as Omit<Product, "id">), id: String(_id), ...(categoryId ? { categoryId: String(categoryId) } : {}) };
}
```

- [ ] **Step 4: Correr las pruebas y ver que pasan**

Run: `npx vitest run src/lib/catalog-query.test.ts && npx tsc --noEmit`
Expected: PASS y sin errores de tipos.

- [ ] **Step 5: Commit**

```bash
git add src/models/CategoryNode.ts src/models/Product.ts src/lib/types.ts src/lib/catalog-query.ts src/lib/catalog-query.test.ts
git commit -m "Categorías: modelo CategoryNode y campos categoryId/categoryPath en los artículos

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Operaciones del árbol con la base (`category-store`)

**Files:**
- Create: `src/lib/category-store.ts`
- Test: `src/lib/category-store.test.ts`

**Interfaces:**
- Consumes: de la Tarea 1 `CategoryNodeData`, `canMove`, `derivedFields`, `descendantIds`, `findByName`, `nodePath`, `normalizeName`, `slugify`, `uniqueSlug`, `validCategoryName`; de la Tarea 2 `CategoryNodeModel` y los campos de `ProductModel`; `searchTextOf` de `src/lib/product-schema.ts`; `CategoryModel` (modelo viejo `src/models/Category.ts`).
- Produces (todo exportado desde `src/lib/category-store.ts`):
  - `class CategoryError extends Error { code: "invalid" | "not_found" | "duplicate" | "cycle" | "has_children" | "has_products" }`
  - `loadNodes(): Promise<CategoryNodeData[]>`
  - `createNode(parentId: string | null, name: string): Promise<CategoryNodeData>`
  - `renameNode(id: string, name: string): Promise<void>`
  - `moveNode(id: string, newParentId: string | null): Promise<void>`
  - `deleteNode(id: string): Promise<void>`
  - `moveProducts(fromId: string, toId: string): Promise<number>`
  - `ensurePath(names: string[], known?: CategoryNodeData[]): Promise<CategoryNodeData[]>`
  - `countsByNode(includeInactive: boolean): Promise<Record<string, number>>`
  - `categoryFieldsFor(id: string): Promise<{ categoryId: Types.ObjectId; categoryPath: Types.ObjectId[]; category: string; subCategory: string } | null>`
  - `convertLegacy(): Promise<{ created: number; assigned: number }>`
  - `legacyProductCount(): Promise<number>`

- [ ] **Step 1: Escribir las pruebas que fallan**

Crear `src/lib/category-store.test.ts`:

```ts
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { CategoryModel } from "@/models/Category";
import { CategoryNodeModel } from "@/models/CategoryNode";
import { ProductModel } from "@/models/Product";
import {
  categoryFieldsFor, CategoryError, convertLegacy, countsByNode, createNode, deleteNode, ensurePath, legacyProductCount,
  loadNodes, moveNode, moveProducts, renameNode
} from "./category-store";

// Prueba de integración: usa una base de pruebas en MongoDB local. Si no hay Mongo, se omite.
const uri = process.env.MONGODB_TEST_URI || "mongodb://localhost:27017/catalogo_test";
let available = false;

beforeAll(async () => {
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 1500 });
    await Promise.all([ProductModel.syncIndexes(), CategoryNodeModel.syncIndexes()]);
    available = true;
  } catch {
    available = false;
  }
});
afterAll(async () => { if (available) { await clean(); await mongoose.disconnect(); } });
beforeEach(async () => { if (available) await clean(); });
async function clean() { await Promise.all([ProductModel.deleteMany({}), CategoryNodeModel.deleteMany({}), CategoryModel.deleteMany({})]); }

let counter = 0;
async function product(fields: Record<string, unknown> = {}) {
  counter += 1;
  return ProductModel.create({ sku: `S${counter}`, skuKey: `s${counter}`, name: `Artículo ${counter}`, cashPrice: 1, listPrice: 2, category: "Sin", ...fields });
}
async function assign(id: string, path: string[]) {
  const nodes = await loadNodes();
  const fields = await categoryFieldsFor(id);
  void nodes;
  return ProductModel.create({ sku: path.join("-") + (counter += 1), skuKey: path.join("-").toLowerCase() + counter, name: "Producto", cashPrice: 1, listPrice: 2, ...fields });
}

describe("createNode", () => {
  it("crea con dirección y rechaza duplicados sin distinguir tildes ni mayúsculas", async (ctx) => {
    if (!available) return ctx.skip();
    const root = await createNode(null, "  Climatización ");
    expect(root).toMatchObject({ name: "Climatización", slug: "climatizacion", parentId: null });
    await expect(createNode(null, "CLIMATIZACION")).rejects.toMatchObject({ code: "duplicate" });
    const child = await createNode(root.id, "Aires");
    expect(child.parentId).toBe(root.id);
  });
  it("el mismo nombre en distinto nivel es válido", async (ctx) => {
    if (!available) return ctx.skip();
    const a = await createNode(null, "Hogar");
    await createNode(null, "Cocina");
    await expect(createNode(a.id, "Cocina")).resolves.toMatchObject({ name: "Cocina" });
  });
  it("valida el largo y el padre", async (ctx) => {
    if (!available) return ctx.skip();
    await expect(createNode(null, "A")).rejects.toMatchObject({ code: "invalid" });
    await expect(createNode("a".repeat(24), "Algo")).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("renameNode", () => {
  it("renombra y actualiza category/subCategory y búsqueda de los artículos de la rama", async (ctx) => {
    if (!available) return ctx.skip();
    const root = await createNode(null, "Climatizacion");
    const sub = await createNode(root.id, "Aires");
    await assign(sub.id, ["Climatizacion", "Aires"]);
    await renameNode(root.id, "Climatización");
    const found = await ProductModel.findOne({ categoryId: sub.id }).lean() as unknown as Record<string, string>;
    expect(found.category).toBe("Climatización");
    expect(found.subCategory).toBe("Aires");
    expect(found.searchText).toContain("climatizacion");
    expect((await loadNodes()).find((n) => n.id === root.id)?.slug).toBe("climatizacion");
  });
  it("rechaza un nombre que ya usa un hermano", async (ctx) => {
    if (!available) return ctx.skip();
    const a = await createNode(null, "Hogar");
    await createNode(null, "Bazar");
    await expect(renameNode(a.id, "bazar")).rejects.toMatchObject({ code: "duplicate" });
  });
});

describe("moveNode", () => {
  it("mueve la rama y recalcula el camino de los artículos", async (ctx) => {
    if (!available) return ctx.skip();
    const clima = await createNode(null, "Climatización");
    const hogar = await createNode(null, "Hogar");
    const aires = await createNode(clima.id, "Aires");
    const split = await createNode(aires.id, "Split");
    await assign(split.id, ["Climatización", "Aires", "Split"]);
    await moveNode(aires.id, hogar.id);
    const found = await ProductModel.findOne({ categoryId: split.id }).lean() as unknown as { category: string; subCategory: string; categoryPath: unknown[] };
    expect(found.category).toBe("Hogar");
    expect(found.subCategory).toBe("Aires");
    expect(found.categoryPath.map(String)).toEqual([hogar.id, aires.id, split.id]);
  });
  it("rechaza mover dentro de sí misma o de una subcategoría suya y no cambia nada", async (ctx) => {
    if (!available) return ctx.skip();
    const root = await createNode(null, "Climatización");
    const child = await createNode(root.id, "Aires");
    await expect(moveNode(root.id, root.id)).rejects.toMatchObject({ code: "cycle" });
    await expect(moveNode(root.id, child.id)).rejects.toMatchObject({ code: "cycle" });
    const nodes = await loadNodes();
    expect(nodes.find((n) => n.id === root.id)?.parentId).toBeNull();
  });
  it("rechaza si el destino ya tiene una categoría con ese nombre", async (ctx) => {
    if (!available) return ctx.skip();
    const a = await createNode(null, "Hogar");
    const b = await createNode(null, "Cocina");
    await createNode(a.id, "Cocina");
    await expect(moveNode(b.id, a.id)).rejects.toMatchObject({ code: "duplicate" });
  });
});

describe("deleteNode", () => {
  it("bloquea si tiene subcategorías o artículos y no pierde nada", async (ctx) => {
    if (!available) return ctx.skip();
    const root = await createNode(null, "Climatización");
    const child = await createNode(root.id, "Aires");
    await assign(child.id, ["Climatización", "Aires"]);
    await expect(deleteNode(root.id)).rejects.toMatchObject({ code: "has_children" });
    await expect(deleteNode(child.id)).rejects.toMatchObject({ code: "has_products" });
    expect(await loadNodes()).toHaveLength(2);
    expect(await ProductModel.countDocuments()).toBe(1);
  });
  it("borra una categoría vacía", async (ctx) => {
    if (!available) return ctx.skip();
    const root = await createNode(null, "Vacía");
    await deleteNode(root.id);
    expect(await loadNodes()).toHaveLength(0);
  });
});

describe("moveProducts", () => {
  it("pasa los artículos de una categoría (y sus subcategorías) a otra", async (ctx) => {
    if (!available) return ctx.skip();
    const a = await createNode(null, "Origen");
    const sub = await createNode(a.id, "Sub");
    const b = await createNode(null, "Destino");
    await assign(a.id, ["Origen"]);
    await assign(sub.id, ["Origen", "Sub"]);
    expect(await moveProducts(a.id, b.id)).toBe(2);
    expect(await ProductModel.countDocuments({ categoryId: b.id })).toBe(2);
    const moved = await ProductModel.findOne({ categoryId: b.id }).lean() as unknown as { category: string };
    expect(moved.category).toBe("Destino");
  });
});

describe("ensurePath", () => {
  it("crea lo que falta y reutiliza lo que existe aunque cambien tildes, mayúsculas o espacios", async (ctx) => {
    if (!available) return ctx.skip();
    const first = await ensurePath(["Climatización", "Aires acondicionados", "Split"]);
    const again = await ensurePath(["  CLIMATIZACION ", "aires   acondicionados", "Split"]);
    expect(again.map((n) => n.id)).toEqual(first.map((n) => n.id));
    expect(await loadNodes()).toHaveLength(3);
  });
});

describe("countsByNode / categoryFieldsFor", () => {
  it("cuenta artículos por rama (incluye descendientes) y puede excluir inactivos", async (ctx) => {
    if (!available) return ctx.skip();
    const root = await createNode(null, "Climatización");
    const aires = await createNode(root.id, "Aires");
    await assign(aires.id, ["a"]);
    const inactive = await assign(aires.id, ["b"]);
    await ProductModel.updateOne({ _id: inactive._id }, { active: false });
    expect((await countsByNode(true))[root.id]).toBe(2);
    expect((await countsByNode(false))[root.id]).toBe(1);
    expect((await countsByNode(false))[aires.id]).toBe(1);
  });
  it("categoryFieldsFor devuelve camino y copias derivadas, o null si no existe", async (ctx) => {
    if (!available) return ctx.skip();
    const root = await createNode(null, "Climatización");
    const aires = await createNode(root.id, "Aires");
    const fields = await categoryFieldsFor(aires.id);
    expect(fields).toMatchObject({ category: "Climatización", subCategory: "Aires" });
    expect(fields!.categoryPath.map(String)).toEqual([root.id, aires.id]);
    expect(await categoryFieldsFor("b".repeat(24))).toBeNull();
  });
});

describe("convertLegacy", () => {
  it("convierte las categorías planas y deja todos los artículos con categoryId", async (ctx) => {
    if (!available) return ctx.skip();
    await product({ category: "Cocinas" });
    await product({ category: "Cocinas" });
    await product({ category: "Hogar", subCategory: "Bazar" });
    await CategoryModel.create({ name: "Vacía", subCategories: ["Una"] });
    expect(await legacyProductCount()).toBe(3);
    const result = await convertLegacy();
    expect(result.assigned).toBe(3);
    expect(await legacyProductCount()).toBe(0);
    const names = (await loadNodes()).map((n) => n.name).sort();
    expect(names).toEqual(["Bazar", "Cocinas", "Hogar", "Una", "Vacía"]);
    expect(await ProductModel.countDocuments()).toBe(3);
  });
  it("es idempotente", async (ctx) => {
    if (!available) return ctx.skip();
    await product({ category: "Cocinas" });
    await convertLegacy();
    const again = await convertLegacy();
    expect(again).toEqual({ created: 0, assigned: 0 });
  });
  it("un artículo ya convertido no se toca", async (ctx) => {
    if (!available) return ctx.skip();
    const root = await createNode(null, "Climatización");
    await assign(root.id, ["x"]);
    await convertLegacy();
    expect((await loadNodes())).toHaveLength(1);
  });
});

describe("CategoryError", () => {
  it("lleva el código", () => {
    expect(new CategoryError("cycle", "x").code).toBe("cycle");
  });
});
```

- [ ] **Step 2: Correr las pruebas y ver que fallan**

Run: `docker start mongo-catalogo; npx vitest run src/lib/category-store.test.ts`
Expected: FAIL (`Cannot find module './category-store'`).

- [ ] **Step 3: Implementar**

Crear `src/lib/category-store.ts`:

```ts
import { Types } from "mongoose";
import {
  canMove, CategoryNodeData, derivedFields, descendantIds, findByName, nodePath, normalizeName, slugify, uniqueSlug, validCategoryName
} from "@/lib/category-tree";
import { searchTextOf } from "@/lib/product-schema";
import { CategoryModel } from "@/models/Category";
import { CategoryNodeModel } from "@/models/CategoryNode";
import { ProductModel } from "@/models/Product";

export class CategoryError extends Error {
  constructor(public code: "invalid" | "not_found" | "duplicate" | "cycle" | "has_children" | "has_products", message: string) {
    super(message);
  }
}

type Row = { _id: Types.ObjectId; name: string; slug: string; parentId: Types.ObjectId | null };
const toData = (row: Row): CategoryNodeData => ({ id: String(row._id), name: row.name, slug: row.slug, parentId: row.parentId ? String(row.parentId) : null });
const cleanName = (name: string) => name.replace(/\s+/g, " ").trim();

export async function loadNodes(): Promise<CategoryNodeData[]> {
  const rows = (await CategoryNodeModel.find().lean()) as unknown as Row[];
  return rows.map(toData);
}

export async function createNode(parentId: string | null, rawName: string): Promise<CategoryNodeData> {
  const name = cleanName(rawName);
  if (!validCategoryName(name)) throw new CategoryError("invalid", "El nombre tiene que tener entre 2 y 60 caracteres.");
  const nodes = await loadNodes();
  if (parentId && !nodes.some((node) => node.id === parentId)) throw new CategoryError("not_found", "La categoría padre no existe.");
  if (findByName(nodes, parentId, name)) throw new CategoryError("duplicate", "Ya existe una categoría con ese nombre en ese nivel.");
  const slug = uniqueSlug(slugify(name), nodes.filter((node) => node.parentId === parentId).map((node) => node.slug));
  const doc = await CategoryNodeModel.create({ name, slug, nameKey: normalizeName(name), parentId: parentId ? new Types.ObjectId(parentId) : null });
  return toData(doc.toObject() as unknown as Row);
}

/** Pone categoría, camino y copias derivadas (y el texto de búsqueda) a los artículos que cumplan el filtro. */
async function setProductsCategory(filter: Record<string, unknown>, path: CategoryNodeData[]): Promise<number> {
  if (path.length === 0) return 0;
  const { category, subCategory } = derivedFields(path);
  const ids = path.map((node) => new Types.ObjectId(node.id));
  const leaf = ids[ids.length - 1];
  const rows = (await ProductModel.find(filter).select("sku name brand").lean()) as unknown as { _id: Types.ObjectId; sku?: string; name?: string; brand?: string }[];
  for (let i = 0; i < rows.length; i += 1000) {
    await ProductModel.bulkWrite(rows.slice(i, i + 1000).map((row) => ({
      updateOne: { filter: { _id: row._id }, update: { $set: { categoryId: leaf, categoryPath: ids, category, subCategory, searchText: searchTextOf({ ...row, category, subCategory }) } } }
    })));
  }
  return rows.length;
}

/** Recalcula camino y copias derivadas de todos los artículos de una rama (después de renombrar o mover). */
async function recomputeBranch(nodeId: string): Promise<void> {
  const nodes = await loadNodes();
  for (const id of [nodeId, ...descendantIds(nodes, nodeId)]) await setProductsCategory({ categoryId: id }, nodePath(nodes, id));
}

export async function renameNode(id: string, rawName: string): Promise<void> {
  const name = cleanName(rawName);
  if (!validCategoryName(name)) throw new CategoryError("invalid", "El nombre tiene que tener entre 2 y 60 caracteres.");
  const nodes = await loadNodes();
  const node = nodes.find((item) => item.id === id);
  if (!node) throw new CategoryError("not_found", "La categoría no existe.");
  const clash = findByName(nodes, node.parentId, name);
  if (clash && clash.id !== id) throw new CategoryError("duplicate", "Ya existe una categoría con ese nombre en ese nivel.");
  const slug = uniqueSlug(slugify(name), nodes.filter((item) => item.parentId === node.parentId && item.id !== id).map((item) => item.slug));
  await CategoryNodeModel.updateOne({ _id: id }, { $set: { name, slug, nameKey: normalizeName(name) } });
  await recomputeBranch(id);
}

export async function moveNode(id: string, newParentId: string | null): Promise<void> {
  const nodes = await loadNodes();
  const node = nodes.find((item) => item.id === id);
  if (!node) throw new CategoryError("not_found", "La categoría no existe.");
  if (!canMove(nodes, id, newParentId)) throw new CategoryError("cycle", "No se puede mover una categoría dentro de sí misma ni de sus subcategorías.");
  if (node.parentId === newParentId) return;
  const clash = findByName(nodes, newParentId, node.name);
  if (clash && clash.id !== id) throw new CategoryError("duplicate", "El destino ya tiene una categoría con ese nombre.");
  const slug = uniqueSlug(node.slug, nodes.filter((item) => item.parentId === newParentId && item.id !== id).map((item) => item.slug));
  await CategoryNodeModel.updateOne({ _id: id }, { $set: { parentId: newParentId ? new Types.ObjectId(newParentId) : null, slug } });
  await recomputeBranch(id);
}

export async function deleteNode(id: string): Promise<void> {
  const nodes = await loadNodes();
  if (!nodes.some((node) => node.id === id)) throw new CategoryError("not_found", "La categoría no existe.");
  if (nodes.some((node) => node.parentId === id)) throw new CategoryError("has_children", "Tiene subcategorías. Movelas o borralas antes.");
  if (await ProductModel.exists({ categoryId: id })) throw new CategoryError("has_products", "Tiene artículos. Pasalos a otra categoría antes de borrarla.");
  await CategoryNodeModel.deleteOne({ _id: id });
}

/** Pasa todos los artículos de una categoría (y de sus subcategorías) a otra. */
export async function moveProducts(fromId: string, toId: string): Promise<number> {
  const nodes = await loadNodes();
  if (!nodes.some((node) => node.id === fromId) || !nodes.some((node) => node.id === toId)) throw new CategoryError("not_found", "La categoría no existe.");
  if (fromId === toId) return 0;
  return setProductsCategory({ categoryId: { $in: [fromId, ...descendantIds(nodes, fromId)] } }, nodePath(nodes, toId));
}

/** Devuelve el camino de nodos para una lista de nombres, creando los que no existan (sin distinguir tildes ni mayúsculas). */
export async function ensurePath(names: string[], known?: CategoryNodeData[]): Promise<CategoryNodeData[]> {
  const nodes = known ?? (await loadNodes());
  const path: CategoryNodeData[] = [];
  let parentId: string | null = null;
  for (const name of names) {
    let node = findByName(nodes, parentId, name);
    if (!node) {
      node = await createNode(parentId, name);
      nodes.push(node);
    }
    path.push(node);
    parentId = node.id;
  }
  return path;
}

/** Cantidad de artículos por categoría; cada artículo cuenta en todos los niveles de su camino. */
export async function countsByNode(includeInactive: boolean): Promise<Record<string, number>> {
  const match: Record<string, unknown> = { categoryPath: { $exists: true, $ne: [] } };
  if (!includeInactive) match.active = { $ne: false };
  const rows = (await ProductModel.aggregate([{ $match: match }, { $unwind: "$categoryPath" }, { $group: { _id: "$categoryPath", count: { $sum: 1 } } }])) as { _id: Types.ObjectId; count: number }[];
  return Object.fromEntries(rows.map((row) => [String(row._id), row.count]));
}

export async function categoryFieldsFor(id: string) {
  const path = nodePath(await loadNodes(), id);
  if (path.length === 0) return null;
  return { categoryId: new Types.ObjectId(id), categoryPath: path.map((node) => new Types.ObjectId(node.id)), ...derivedFields(path) };
}

export const legacyProductCount = (): Promise<number> => ProductModel.countDocuments({ categoryId: null });

/** Convierte las categorías planas de hoy al árbol. Se puede repetir sin duplicar nada. */
export async function convertLegacy(): Promise<{ created: number; assigned: number }> {
  const nodes = await loadNodes();
  const before = nodes.length;
  const saved = (await CategoryModel.find().lean()) as unknown as { name: string; subCategories?: string[] }[];
  for (const category of saved) {
    if (validCategoryName(category.name)) await ensurePath([category.name], nodes);
    for (const sub of category.subCategories ?? []) if (validCategoryName(category.name) && validCategoryName(sub)) await ensurePath([category.name, sub], nodes);
  }
  const pairs = (await ProductModel.aggregate([
    { $match: { categoryId: null } },
    { $group: { _id: { category: "$category", subCategory: "$subCategory" } } }
  ])) as { _id: { category?: string; subCategory?: string } }[];
  let assigned = 0;
  for (const pair of pairs) {
    const category = cleanName(pair._id.category ?? "");
    const subCategory = cleanName(pair._id.subCategory ?? "");
    const names = [category, subCategory].filter(Boolean);
    if (names.length === 0 || !names.every(validCategoryName)) continue;
    const path = await ensurePath(names, nodes);
    assigned += await setProductsCategory({ categoryId: null, category: pair._id.category ?? "", subCategory: pair._id.subCategory ? pair._id.subCategory : { $in: ["", null] } }, path);
  }
  return { created: nodes.length - before, assigned };
}
```

- [ ] **Step 4: Correr las pruebas y ver que pasan**

Run: `npx vitest run src/lib/category-store.test.ts && npx tsc --noEmit`
Expected: PASS (con Mongo encendido ninguna prueba se omite) y sin errores de tipos.

- [ ] **Step 5: Commit**

```bash
git add src/lib/category-store.ts src/lib/category-store.test.ts
git commit -m "Categorías: operaciones del árbol con la base (crear, renombrar, mover, borrar, convertir)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: API del admin para el árbol y artículos con `categoryId`

**Files:**
- Create: `src/app/api/admin/category-tree/route.ts`
- Modify: `src/lib/product-schema.ts`
- Modify: `src/app/api/admin/products/route.ts`
- Modify: `src/app/api/admin/products/[id]/route.ts`

**Interfaces:**
- Consumes: de la Tarea 3 `CategoryError`, `loadNodes`, `createNode`, `renameNode`, `moveNode`, `deleteNode`, `moveProducts`, `countsByNode`, `legacyProductCount`, `convertLegacy`, `categoryFieldsFor`.
- Produces:
  - `GET /api/admin/category-tree` → `{ nodes: CategoryNodeData[]; counts: Record<string, number>; legacyProducts: number }`.
  - `POST /api/admin/category-tree` con `{ action: "create", parentId: string|null, name }`, `{ action: "rename", id, name }`, `{ action: "move", id, newParentId: string|null }`, `{ action: "move-products", fromId, toId }` o `{ action: "convert" }`.
  - `DELETE /api/admin/category-tree` con `{ id }`.
  - Respuestas de error `{ error: string }` con estado 400 (`invalid`, `cycle`), 404 (`not_found`) o 409 (`duplicate`, `has_children`, `has_products`).
  - `productInputSchema` pide `categoryId` (texto de 24 caracteres hexadecimales) en lugar de `category`/`subCategory`.
  - Las rutas de artículos guardan `categoryId`, `categoryPath`, `category` y `subCategory` (derivados) a partir de `categoryId`.

- [ ] **Step 1: Cambiar el esquema del artículo**

En `src/lib/product-schema.ts`, reemplazar las líneas de `category` y `subCategory` dentro de `productInputSchema`:

```ts
  category: z.string().trim().min(2),
  subCategory: z.string().trim().default(""),
```

por:

```ts
  categoryId: z.string().regex(/^[a-f0-9]{24}$/, "Elegí una categoría"),
```

- [ ] **Step 2: Crear la ruta del árbol**

Crear `src/app/api/admin/category-tree/route.ts`:

```ts
import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin, unauthorized } from "@/lib/admin-auth";
import {
  CategoryError, convertLegacy, countsByNode, createNode, deleteNode, legacyProductCount, loadNodes, moveNode, moveProducts, renameNode
} from "@/lib/category-store";
import { connectDb } from "@/lib/db";

const id = z.string().regex(/^[a-f0-9]{24}$/);
const action = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), parentId: id.nullable(), name: z.string() }),
  z.object({ action: z.literal("rename"), id, name: z.string() }),
  z.object({ action: z.literal("move"), id, newParentId: id.nullable() }),
  z.object({ action: z.literal("move-products"), fromId: id, toId: id }),
  z.object({ action: z.literal("convert") })
]);

const STATUS: Record<CategoryError["code"], number> = { invalid: 400, cycle: 400, not_found: 404, duplicate: 409, has_children: 409, has_products: 409 };

function failure(error: unknown) {
  if (error instanceof CategoryError) return NextResponse.json({ error: error.message }, { status: STATUS[error.code] });
  throw error;
}

export async function GET(request: Request) {
  if (!(await isAdmin(request))) return unauthorized();
  await connectDb();
  const [nodes, counts, legacyProducts] = await Promise.all([loadNodes(), countsByNode(true), legacyProductCount()]);
  return NextResponse.json({ nodes, counts, legacyProducts });
}

export async function POST(request: Request) {
  if (!(await isAdmin(request))) return unauthorized();
  const data = action.safeParse(await request.json().catch(() => null));
  if (!data.success) return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  await connectDb();
  try {
    const body = data.data;
    let result: unknown = { ok: true };
    if (body.action === "create") result = await createNode(body.parentId, body.name);
    else if (body.action === "rename") await renameNode(body.id, body.name);
    else if (body.action === "move") await moveNode(body.id, body.newParentId);
    else if (body.action === "move-products") result = { moved: await moveProducts(body.fromId, body.toId) };
    else result = await convertLegacy();
    revalidateTag("category-tree");
    return NextResponse.json(result);
  } catch (error) {
    return failure(error);
  }
}

export async function DELETE(request: Request) {
  if (!(await isAdmin(request))) return unauthorized();
  const data = z.object({ id }).safeParse(await request.json().catch(() => null));
  if (!data.success) return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  await connectDb();
  try {
    await deleteNode(data.data.id);
    revalidateTag("category-tree");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return failure(error);
  }
}
```

- [ ] **Step 3: Guardar `categoryId` y derivados en las rutas de artículos**

En `src/app/api/admin/products/route.ts`, agregar el import `import { categoryFieldsFor } from "@/lib/category-store";` y reemplazar el cuerpo de `POST` (desde `await connectDb();` dentro de `POST`) por:

```ts
  await connectDb();
  const { categoryId, ...rest } = data.data;
  const fields = await categoryFieldsFor(categoryId);
  if (!fields) return NextResponse.json({ error: "La categoría elegida no existe." }, { status: 400 });
  try {
    const product = await ProductModel.create(withSearchText({ ...rest, ...fields }));
    return NextResponse.json({ id: String(product._id) }, { status: 201 });
  } catch (error) {
    if ((error as { code?: number }).code === 11000) return NextResponse.json({ error: "Ya existe un artículo con ese SKU" }, { status: 409 });
    throw error;
  }
```

En `src/app/api/admin/products/[id]/route.ts`, agregar el import `import { categoryFieldsFor } from "@/lib/category-store";` y reemplazar el bloque `try { const product = await ProductModel.findByIdAndUpdate(...` de `PATCH` (después de la comprobación `isObjectId(id)`) por:

```ts
  const { categoryId, ...rest } = data.data;
  const fields = await categoryFieldsFor(categoryId);
  if (!fields) return NextResponse.json({ error: "La categoría elegida no existe." }, { status: 400 });
  try {
    const product = await ProductModel.findByIdAndUpdate(id, withSearchText({ ...rest, ...fields }), { new: true });
    if (!product) return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
  } catch (error) {
    if ((error as { code?: number }).code === 11000) return NextResponse.json({ error: "Ya existe un artículo con ese SKU" }, { status: 409 });
    throw error;
  }
```

- [ ] **Step 4: Verificar tipos y probar la API a mano**

Run: `npx tsc --noEmit` — Expected: sin errores en estos archivos (los errores de `products-tab.tsx` por `category` se resuelven en la Tarea 5; si aparecen, anotarlos y seguir).

Probar (servidor local encendido con `docker start mongo-catalogo; npm run dev`):

```bash
cd "/home/mati/Escritorio/Proyectos electronorte/catalogo-electronorte"
PW=$(grep '^ADMIN_PASSWORD=' .env.local | cut -d= -f2-); J=/tmp/claude-1000/cj-cat.txt; B=http://localhost:3000/api/admin
curl -s -c $J -H 'Content-Type: application/json' -d "{\"password\":$(printf '%s' "$PW" | python3 -c 'import json,sys;print(json.dumps(sys.stdin.read()))')}" $B/session -o /dev/null -w "login %{http_code}\n"
curl -s http://localhost:3000/api/admin/category-tree -w " [sin sesión %{http_code}]\n"
curl -s -b $J $B/category-tree | python3 -c 'import json,sys;d=json.load(sys.stdin);print("nodos:",len(d["nodes"]),"| artículos sin convertir:",d["legacyProducts"])'
curl -s -b $J -H 'Content-Type: application/json' -d '{"action":"create","parentId":null,"name":"Prueba"}' $B/category-tree -w " [%{http_code}]\n"
curl -s -b $J -H 'Content-Type: application/json' -d '{"action":"create","parentId":null,"name":"PRUEBA"}' $B/category-tree -w " [duplicado %{http_code}]\n"
```
Expected: `[sin sesión 401]`, el nodo "Prueba" se crea (200) y el duplicado da 409. Después borrar la prueba: `curl -s -b $J -X DELETE -H 'Content-Type: application/json' -d '{"id":"<id devuelto>"}' $B/category-tree`.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/category-tree/route.ts src/lib/product-schema.ts src/app/api/admin/products/route.ts "src/app/api/admin/products/[id]/route.ts"
git commit -m "Categorías: API del admin para el árbol y artículos guardados con categoryId

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Admin: pestaña Categorías como árbol y selector en cascada

**Files:**
- Create: `src/components/admin/categories-tab.tsx`
- Create: `src/components/admin/category-picker.tsx`
- Modify: `src/components/admin/products-tab.tsx`
- Modify: `src/components/admin-panel.tsx`
- Delete: `src/app/api/admin/subcategories/route.ts`, `src/app/api/admin/categories/route.ts`
- Modify: `src/app/admin.css`

**Interfaces:**
- Consumes: la API de la Tarea 4; `buildTree`, `formatPath`, `nodePath`, `descendantIds`, `CategoryNodeData`, `TreeNode` de la Tarea 1.
- Produces:
  - `<CategoryPicker nodes={CategoryNodeData[]} value={string} onChange={(id: string) => void} />` (selectores en cascada; `value` es el id del nodo más profundo elegido o `""`).
  - `<CategoriesTab onChange={() => void} />` (árbol editable; llama a `onChange` cuando cambia algo).
  - `ProductsTab` pasa a recibir `nodes: CategoryNodeData[]` en lugar de `categories`/`subCategories`.

- [ ] **Step 1: Crear el selector en cascada**

Crear `src/components/admin/category-picker.tsx`:

```tsx
"use client";

import { buildTree, nodePath, type CategoryNodeData } from "@/lib/category-tree";

/** Selectores en cascada: nivel 1, nivel 2, nivel 3… `value` es el id del nodo más profundo elegido. */
export function CategoryPicker({ nodes, value, onChange }: { nodes: CategoryNodeData[]; value: string; onChange: (id: string) => void }) {
  const tree = buildTree(nodes);
  const chosen = value ? nodePath(nodes, value) : [];
  const levels: { options: { id: string; name: string }[]; selected: string }[] = [{ options: tree.map((n) => ({ id: n.id, name: n.name })), selected: chosen[0]?.id ?? "" }];
  let current = tree.find((n) => n.id === chosen[0]?.id);
  for (let depth = 1; current && current.children.length > 0; depth++) {
    levels.push({ options: current.children.map((n) => ({ id: n.id, name: n.name })), selected: chosen[depth]?.id ?? "" });
    current = current.children.find((n) => n.id === chosen[depth]?.id);
  }
  const pick = (depth: number, id: string) => onChange(id || (depth > 0 ? chosen[depth - 1].id : ""));
  return <div className="category-picker">
    {levels.map((level, depth) => <label className="field" key={depth}>{depth === 0 ? "Categoría" : `Subcategoría${depth > 1 ? ` (nivel ${depth + 1})` : ""}`}
      <select value={level.selected} onChange={(e) => pick(depth, e.target.value)} required={depth === 0}>
        <option value="">{depth === 0 ? "Elegí una categoría…" : "Sin subcategoría"}</option>
        {level.options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
    </label>)}
  </div>;
}
```

- [ ] **Step 2: Crear la pestaña del árbol**

Crear `src/components/admin/categories-tab.tsx`:

```tsx
"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { buildTree, descendantIds, formatPath, nodePath, type CategoryNodeData, type TreeNode } from "@/lib/category-tree";

type Data = { nodes: CategoryNodeData[]; counts: Record<string, number>; legacyProducts: number };
type Pending = { id: string; kind: "move" | "move-products" } | null;

export function CategoriesTab({ onChange }: { onChange: () => void }) {
  const [data, setData] = useState<Data>({ nodes: [], counts: {}, legacyProducts: 0 });
  const [message, setMessage] = useState("");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<Pending>(null);
  const [adding, setAdding] = useState<string | null>(null);

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/category-tree");
    if (response.ok) setData(await response.json());
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function send(method: "POST" | "DELETE", body: object, fallback: string): Promise<boolean> {
    const response = await fetch("/api/admin/category-tree", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) { setMessage(result.error ?? fallback); return false; }
    setMessage("");
    await load();
    onChange();
    return true;
  }

  async function add(event: FormEvent<HTMLFormElement>, parentId: string | null) {
    event.preventDefault();
    const form = event.currentTarget;
    const name = String(new FormData(form).get("name") ?? "").trim();
    if (!name) return;
    if (await send("POST", { action: "create", parentId, name }, "No se pudo crear la categoría.")) {
      form.reset();
      if (parentId) setOpen((current) => new Set(current).add(parentId));
      setAdding(null);
    }
  }

  async function rename(node: CategoryNodeData) {
    const name = window.prompt(`Nuevo nombre para "${node.name}":`, node.name)?.trim();
    if (name && name !== node.name) await send("POST", { action: "rename", id: node.id, name }, "No se pudo renombrar.");
  }

  async function remove(node: CategoryNodeData) {
    if (window.confirm(`¿Borrar la categoría "${node.name}"?`)) await send("DELETE", { id: node.id }, "No se pudo borrar.");
  }

  async function choose(event: FormEvent<HTMLSelectElement>, node: CategoryNodeData, kind: "move" | "move-products") {
    const value = event.currentTarget.value;
    if (value === "__none") return;
    const target = value === "__root" ? null : value;
    if (kind === "move") await send("POST", { action: "move", id: node.id, newParentId: target }, "No se pudo mover.");
    else if (target && window.confirm(`¿Pasar todos los artículos de "${node.name}" a "${formatPath(nodePath(data.nodes, target))}"?`)) await send("POST", { action: "move-products", fromId: node.id, toId: target }, "No se pudieron mover los artículos.");
    setPending(null);
  }

  const toggle = (id: string) => setOpen((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const optionsFor = (node: CategoryNodeData, kind: "move" | "move-products") => {
    const banned = new Set([node.id, ...(kind === "move" ? descendantIds(data.nodes, node.id) : [])]);
    return data.nodes.filter((n) => !banned.has(n.id)).map((n) => ({ id: n.id, label: formatPath(nodePath(data.nodes, n.id)) })).sort((a, b) => a.label.localeCompare(b.label, "es"));
  };

  const row = (node: TreeNode, depth: number): React.ReactNode => {
    const count = data.counts[node.id] ?? 0;
    const isOpen = open.has(node.id);
    return <div key={node.id} className="tree-item">
      <div className="tree-row" style={{ paddingLeft: depth * 22 }}>
        <button type="button" className="tree-toggle" onClick={() => toggle(node.id)} aria-expanded={isOpen} aria-label={isOpen ? "Cerrar" : "Abrir"} disabled={node.children.length === 0}>{node.children.length === 0 ? "·" : isOpen ? "▾" : "▸"}</button>
        <b>{node.name}</b>
        <span className="tree-count">{count} {count === 1 ? "artículo" : "artículos"}</span>
        <span className="tree-actions">
          <button type="button" className="row-action" onClick={() => setAdding(adding === node.id ? null : node.id)}>+ Subcategoría</button>
          <button type="button" className="row-action" onClick={() => void rename(node)}>Renombrar</button>
          <button type="button" className="row-action" onClick={() => setPending({ id: node.id, kind: "move" })}>Mover</button>
          <button type="button" className="row-action" onClick={() => setPending({ id: node.id, kind: "move-products" })} disabled={count === 0}>Mover artículos</button>
          <button type="button" className="row-action danger" onClick={() => void remove(node)}>Borrar</button>
        </span>
      </div>
      {pending?.id === node.id ? <div className="tree-inline" style={{ paddingLeft: depth * 22 + 28 }}>
        <label>{pending.kind === "move" ? "Mover dentro de:" : "Pasar los artículos a:"}
          <select defaultValue="__none" onChange={(e) => void choose(e, node, pending.kind)}>
            <option value="__none">Elegí…</option>
            {pending.kind === "move" ? <option value="__root">Primer nivel (sin padre)</option> : null}
            {optionsFor(node, pending.kind).map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </label>
        <button type="button" className="row-action" onClick={() => setPending(null)}>Cancelar</button>
      </div> : null}
      {adding === node.id ? <form className="tree-inline" style={{ paddingLeft: depth * 22 + 28 }} onSubmit={(e) => void add(e, node.id)}>
        <input name="name" placeholder={`Subcategoría de ${node.name}`} maxLength={60} autoFocus />
        <button>Agregar</button>
      </form> : null}
      {isOpen ? node.children.map((child) => row(child, depth + 1)) : null}
    </div>;
  };

  return <>
    <p>ORGANIZACIÓN</p>
    <h1>Categorías</h1>
    {data.legacyProducts > 0 ? <div className="legacy-banner" role="status">
      <b>Hay {data.legacyProducts} artículos con la categoría vieja (sin árbol).</b> Convertilos para poder organizarlos en subcategorías. Se puede repetir sin problema.
      <button type="button" onClick={async () => { if (await send("POST", { action: "convert" }, "No se pudo convertir.")) setMessage("Listo: las categorías actuales ya forman parte del árbol."); }}>Convertir las categorías actuales</button>
    </div> : null}
    <form className="category-form" onSubmit={(e) => void add(e, null)}>
      <input name="name" placeholder="Nueva categoría de primer nivel" maxLength={60} required />
      <button>Agregar</button>
    </form>
    <small>Las categorías se ordenan de la A a la Z ("Otros" siempre al final). Una categoría solo se puede borrar si no tiene subcategorías ni artículos.</small>
    {message ? <small role="alert" className="tree-message">{message}</small> : null}
    <div className="category-tree-view">{buildTree(data.nodes).map((node) => row(node, 0))}</div>
  </>;
}
```

- [ ] **Step 3: Usar el selector en el formulario de artículos**

En `src/components/admin/products-tab.tsx`:

1. Agregar imports: `import { CategoryPicker } from "./category-picker";` y `import { formatPath, nodePath, type CategoryNodeData } from "@/lib/category-tree";`.
2. Cambiar `emptyForm`: reemplazar `category: "", subCategory: "",` por `categoryId: "",`.
3. Cambiar la firma: `export function ProductsTab({ nodes = [], brands = [] }: { nodes?: CategoryNodeData[]; brands?: string[] })`.
4. En `edit(product)`: reemplazar `category: product.category,` y `subCategory: product.subCategory ?? "",` por `categoryId: product.categoryId ?? "",`.
5. En el envío (donde se arma el cuerpo con `cashPrice`/`listPrice`), reemplazar los campos `category` y `subCategory` por `categoryId: form.categoryId,`.
6. Reemplazar los dos `<input ... list="categories"/"subcategories">` y los dos `<datalist>` de categorías/subcategorías por: `<CategoryPicker nodes={nodes} value={form.categoryId} onChange={(id) => set("categoryId", id)} />`.
7. En la lista de artículos, reemplazar `{product.category}` por `{product.categoryId ? formatPath(nodePath(nodes, product.categoryId)) : product.category}`.

- [ ] **Step 4: Conectar el panel**

En `src/components/admin-panel.tsx`:

1. Agregar imports: `import { CategoriesTab } from "./admin/categories-tab";` y `import type { CategoryNodeData } from "@/lib/category-tree";`.
2. Reemplazar los estados `categories` y `subTree` por `const [nodes, setNodes] = useState<CategoryNodeData[]>([]);`.
3. En `load()`, reemplazar las dos llamadas a `/api/admin/categories` y `/api/admin/subcategories` (y sus `setCategories`/`setSubTree`) por una llamada a `/api/admin/category-tree` y `setNodes(treeData.nodes ?? [])` (si la respuesta no es ok, `{ nodes: [] }`).
4. Borrar las funciones `addCategory`, `renameCategory`, `removeCategory`, `addSubCategory`, `removeSubCategory`.
5. Reemplazar `<ProductsTab categories={categories} subCategories={subTree} brands=... />` por `<ProductsTab nodes={nodes} brands={brands.map((b) => b.name)} />`.
6. Reemplazar todo el bloque `{tab === "categories" && ( ... )}` por `{tab === "categories" && <CategoriesTab onChange={() => void load()} />}`.

- [ ] **Step 5: Quitar las rutas viejas y agregar estilos**

```bash
git rm src/app/api/admin/subcategories/route.ts src/app/api/admin/categories/route.ts
```

Buscar usos restantes: `grep -rn "api/admin/categories\|api/admin/subcategories" src` — Expected: ninguno (si `settings-tab.tsx` o algo más los usa, cambiarlo para que use `/api/admin/category-tree` o `/api/products`).

Agregar al final de `src/app/admin.css`:

```css
.category-picker{grid-column:1 / -1;display:flex;flex-wrap:wrap;gap:8px}
.category-picker .field{flex:1 1 200px}
.category-picker select{padding:10px;border:1px solid var(--line);border-radius:7px;font:inherit;background:#fff;width:100%}
.category-tree-view{display:grid;gap:2px;margin-top:14px;background:#fff;border:1px solid var(--line);border-radius:10px;padding:8px}
.tree-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:6px 8px;border-radius:6px}.tree-row:hover{background:#fff7f7}
.tree-toggle{width:26px;height:26px;padding:0;background:none;color:var(--text);font-size:14px}.tree-toggle:disabled{opacity:.4;cursor:default}
.tree-count{color:var(--muted);font-size:13px}
.tree-actions{display:flex;flex-wrap:wrap;gap:6px;margin-left:auto}
.tree-inline{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:6px 8px}
.tree-inline select,.tree-inline input{padding:8px 10px;border:1px solid var(--line);border-radius:7px;font:inherit;background:#fff}
.tree-message{color:#c72a2a}
.legacy-banner{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:12px 14px;margin:10px 0;border:1px solid #E52627;background:#fff7f7;border-radius:10px}
.row-action:disabled{opacity:.4;cursor:not-allowed}
```

Run: `npx tsc --noEmit` — Expected: sin errores.

- [ ] **Step 6: Verificar en el navegador**

Con el servidor local encendido y sesión de admin: abrir `/admin` → **Categorías**. Verificar: (a) aparece el aviso "Hay N artículos con la categoría vieja" si hay artículos sin convertir (en la base local, sí); (b) crear "Climatización" y dentro "Aires acondicionados" y "Split" (el botón "+ Subcategoría" abre una fila de entrada); (c) renombrar, mover (la lista de destinos no incluye la propia categoría ni sus subcategorías) y borrar una vacía; (d) borrar una con subcategorías muestra el motivo; (e) en **Productos → Editar**, los selectores en cascada muestran las categorías y guardan.

- [ ] **Step 7: Commit**

```bash
git add src/components/admin src/components/admin-panel.tsx src/app/admin.css
git commit -m "Categorías: pestaña del admin como árbol y selector en cascada en el artículo

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Convertir lo actual en local y verificar la etapa 1

**Files:**
- Ninguno nuevo (verificación).

- [ ] **Step 1: Contar antes**

```bash
docker exec mongo-catalogo mongosh --quiet catalogo_electronorte --eval 'print("artículos:", db.products.countDocuments(), "| sin categoryId:", db.products.countDocuments({categoryId:null}), "| nodos:", db.categorynodes.countDocuments())'
```
Expected: `artículos: 2385 | sin categoryId: 2385 | nodos: <las que hayas creado de prueba>` (borrar las de prueba del admin antes si quedaron).

- [ ] **Step 2: Convertir**

En el admin → **Categorías** → botón **"Convertir las categorías actuales"**.

- [ ] **Step 3: Contar después (criterio de aceptación de la migración)**

```bash
docker exec mongo-catalogo mongosh --quiet catalogo_electronorte --eval 'print("artículos:", db.products.countDocuments(), "| sin categoryId:", db.products.countDocuments({categoryId:null}), "| nodos:", db.categorynodes.countDocuments()); print("categorías distintas (campo derivado):", db.products.distinct("category").length)'
```
Expected: `artículos: 2385 | sin categoryId: 0 | nodos: 28` y `categorías distintas: 28`. Repetir el botón: no debe crear nada ("Hay 0 artículos…" ya no aparece el aviso).

- [ ] **Step 4: Verificar que la tienda sigue igual**

```bash
for u in / /catalogo "/catalogo?category=Cocinas%20y%20hornos"; do curl -s -o /dev/null -w "$u -> %{http_code}\n" "http://localhost:3000$u"; done
npx vitest run && npx tsc --noEmit
```
Expected: `200` en las tres y todas las pruebas pasan. (La tienda todavía usa los campos derivados `category`/`subCategory`; las direcciones por camino llegan en la etapa 3.)

- [ ] **Step 5: Commit del estado de etapa (si hubo ajustes)**

```bash
git status --short
```
Si no hay cambios pendientes, no hay nada que commitear. Anotar en la respuesta al usuario: etapa 1 lista y verificada.

---
# ETAPA 2: Excel y convertidor de Contabilium

### Task 7: Importación con caminos de categoría

**Files:**
- Create: `src/lib/import/category-path.ts`
- Test: `src/lib/import/category-path.test.ts`
- Test: `src/lib/import/categories.test.ts` (con base)
- Modify: `src/lib/import/parse-rows.ts`
- Modify: `src/lib/import/apply.ts`
- Modify: `src/lib/import/run.ts`
- Modify: `src/lib/import/run.test.ts` (solo la limpieza de la base)
- Modify: `src/components/admin/import-tab.tsx`

**Interfaces:**
- Consumes: de la Tarea 1 `parsePathText`, `validCategoryName`, `derivedFields`, `normalizeName`, `missingPaths`; de la Tarea 3 `ensurePath`, `loadNodes`.
- Produces:
  - `importPathNames(data: { category?: string; subCategory?: string }): string[] | null` (`null` si la fila no trae categoría).
  - `ImportResult` ahora incluye `newCategories: string[]` (caminos que se crearán o se crearon, en texto `A > B`).
  - `applyImport` guarda `categoryId`, `categoryPath`, `category` y `subCategory` (derivados) en cada artículo con categoría.

- [ ] **Step 1: Escribir las pruebas que fallan**

Crear `src/lib/import/category-path.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { importPathNames } from "./category-path";

describe("importPathNames", () => {
  it("camino completo con >", () => {
    expect(importPathNames({ category: "Climatización > Aires acondicionados > Split" })).toEqual(["Climatización", "Aires acondicionados", "Split"]);
  });
  it("categoría y subcategoría en columnas separadas (como antes)", () => {
    expect(importPathNames({ category: "Hogar", subCategory: "Bazar" })).toEqual(["Hogar", "Bazar"]);
  });
  it("si la categoría ya trae >, ignora la columna de subcategoría", () => {
    expect(importPathNames({ category: "A > B", subCategory: "C" })).toEqual(["A", "B"]);
  });
  it("espacios de más y segmentos vacíos", () => {
    expect(importPathNames({ category: "  Hogar  " })).toEqual(["Hogar"]);
    expect(importPathNames({ category: "A >  > B" })).toEqual(["A", "B"]);
    expect(importPathNames({ category: ">" })).toEqual([]);
  });
  it("sin categoría devuelve null", () => {
    expect(importPathNames({})).toBeNull();
    expect(importPathNames({ subCategory: "Bazar" })).toBeNull();
  });
});
```

Crear `src/lib/import/categories.test.ts`:

```ts
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { CategoryNodeModel } from "@/models/CategoryNode";
import { ProductModel } from "@/models/Product";
import { loadNodes } from "@/lib/category-store";
import { runImport } from "./run";

// Prueba de integración con MongoDB local; se omite si no hay Mongo.
const uri = process.env.MONGODB_TEST_URI || "mongodb://localhost:27017/catalogo_test";
let available = false;
beforeAll(async () => {
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 1500 });
    await Promise.all([ProductModel.syncIndexes(), CategoryNodeModel.syncIndexes()]);
    available = true;
  } catch { available = false; }
});
afterAll(async () => { if (available) { await clean(); await mongoose.disconnect(); } });
beforeEach(async () => { if (available) await clean(); });
async function clean() { await Promise.all([ProductModel.deleteMany({}), CategoryNodeModel.deleteMany({})]); }

const row = (rowNumber: number, cells: Record<string, unknown>) => ({ rowNumber, cells });
const base = { name: "Aire Split 3000", cashPrice: 100, listPrice: 120 };

describe("importación con caminos de categoría", () => {
  it("crea las categorías y deja camino y copias derivadas en el artículo", async (ctx) => {
    if (!available) return ctx.skip();
    const result = await runImport([row(2, { sku: "A1", ...base, category: "Climatización > Aires acondicionados > Split" })], "apply");
    expect(result).toMatchObject({ created: 1, errors: [] });
    expect(result.newCategories).toEqual(["Climatización", "Climatización > Aires acondicionados", "Climatización > Aires acondicionados > Split"]);
    const product = await ProductModel.findOne({ sku: "A1" }).lean() as unknown as { category: string; subCategory: string; categoryPath: unknown[]; searchText: string };
    expect(product.category).toBe("Climatización");
    expect(product.subCategory).toBe("Aires acondicionados");
    expect(product.categoryPath).toHaveLength(3);
    expect(product.searchText).toContain("aires acondicionados");
    expect(await loadNodes()).toHaveLength(3);
  });

  it("la vista previa informa las categorías nuevas y no crea nada", async (ctx) => {
    if (!available) return ctx.skip();
    const result = await runImport([row(2, { sku: "A1", ...base, category: "Hogar > Bazar" })], "preview");
    expect(result.newCategories).toEqual(["Hogar", "Hogar > Bazar"]);
    expect(await loadNodes()).toHaveLength(0);
    expect(await ProductModel.countDocuments()).toBe(0);
  });

  it("tildes, mayúsculas y espacios distintos usan el mismo nodo", async (ctx) => {
    if (!available) return ctx.skip();
    await runImport([row(2, { sku: "A1", ...base, category: "Climatización > Aires" })], "apply");
    const result = await runImport([row(2, { sku: "A2", ...base, category: "  CLIMATIZACION  >  aires " })], "apply");
    expect(result.newCategories).toEqual([]);
    expect(await loadNodes()).toHaveLength(2);
  });

  it("sigue aceptando categoría y subcategoría en columnas separadas", async (ctx) => {
    if (!available) return ctx.skip();
    await runImport([row(2, { sku: "A1", ...base, category: "Hogar", subCategory: "Bazar" })], "apply");
    const product = await ProductModel.findOne({ sku: "A1" }).lean() as unknown as { category: string; subCategory: string };
    expect(product).toMatchObject({ category: "Hogar", subCategory: "Bazar" });
  });

  it("actualizar sin traer categoría no la toca", async (ctx) => {
    if (!available) return ctx.skip();
    await runImport([row(2, { sku: "A1", ...base, category: "Hogar > Bazar" })], "apply");
    await runImport([row(2, { sku: "A1", cashPrice: 5 })], "apply");
    const product = await ProductModel.findOne({ sku: "A1" }).lean() as unknown as { category: string; subCategory: string; cashPrice: number; categoryPath: unknown[] };
    expect(product).toMatchObject({ category: "Hogar", subCategory: "Bazar", cashPrice: 5 });
    expect(product.categoryPath).toHaveLength(2);
  });

  it("caminos raros: error de fila claro y nunca crea categorías vacías", async (ctx) => {
    if (!available) return ctx.skip();
    const result = await runImport([
      row(2, { sku: "B1", ...base, category: ">" }),
      row(3, { sku: "B2", ...base, category: "A" }),
      row(4, { sku: "B3", ...base, category: "x".repeat(61) }),
      row(5, { sku: "B4", ...base, category: "Hogar >  > Bazar" }),
      row(6, { sku: "B5", ...base, subCategory: "Bazar" })
    ], "apply");
    expect(result.errors.map((e) => e.rowNumber)).toEqual([2, 3, 4, 6]);
    expect(result.created).toBe(1);
    const names = (await loadNodes()).map((n) => n.name).sort();
    expect(names).toEqual(["Bazar", "Hogar"]);
  });
});
```

- [ ] **Step 2: Correr las pruebas y ver que fallan**

Run: `docker start mongo-catalogo; npx vitest run src/lib/import/category-path.test.ts src/lib/import/categories.test.ts`
Expected: FAIL (`Cannot find module './category-path'`).

- [ ] **Step 3: Implementar**

Crear `src/lib/import/category-path.ts`:

```ts
import { parsePathText } from "@/lib/category-tree";

/** Nombres del camino de una fila del Excel: "A > B > C", o categoría y subcategoría en columnas separadas. `null` si la fila no trae categoría. */
export function importPathNames(data: { category?: string; subCategory?: string }): string[] | null {
  if (data.category === undefined) return null;
  const names = parsePathText(data.category);
  if (names.length > 0 && !data.category.includes(">") && data.subCategory) names.push(...parsePathText(data.subCategory));
  return names;
}
```

En `src/lib/import/parse-rows.ts`:
1. Agregar imports al principio: `import { validCategoryName } from "@/lib/category-tree";` y `import { importPathNames } from "./category-path";`.
2. Justo después de la línea `for (const field of TEXT_FIELDS) if (!isBlank(cells[field])) data[field] = String(cells[field]).trim();` agregar:

```ts
    if (data.category !== undefined) {
      const names = importPathNames(data);
      const bad = (names ?? []).find((name) => !validCategoryName(name));
      if (!names || names.length === 0) problem = `Categoría inválida: "${data.category}"`;
      else if (bad !== undefined) problem = `Categoría inválida: "${bad}" (tiene que tener entre 2 y 60 caracteres)`;
    } else if (data.subCategory !== undefined) {
      problem = "Trae subcategoría pero no categoría";
    }
```

Reemplazar `src/lib/import/apply.ts` completo por:

```ts
import { Types } from "mongoose";
import { ensurePath, loadNodes } from "@/lib/category-store";
import { derivedFields, normalizeName } from "@/lib/category-tree";
import { skuKeyOf, withSearchText } from "@/lib/product-schema";
import { ProductModel } from "@/models/Product";
import { importPathNames } from "./category-path";
import type { ImportRow, ProductFields } from "./parse-rows";

const BATCH = 500;

export class ImportConflictError extends Error {}

export async function applyImport(plan: { toCreate: ImportRow[]; toUpdate: ImportRow[] }) {
  const keys = [...new Set(plan.toUpdate.map((r) => skuKeyOf(r.sku)))];
  const existing = keys.length ? await ProductModel.find({ skuKey: { $in: keys } }, "sku skuKey name brand category subCategory").lean() : [];
  const current = new Map(existing.map((p) => [String(p.skuKey), p]));

  // las categorías se resuelven una sola vez por camino (se crean las que falten)
  const nodes = await loadNodes();
  const resolved = new Map<string, Awaited<ReturnType<typeof ensurePath>>>();
  const categoryData = async (data: Partial<ProductFields>) => {
    const names = importPathNames(data);
    if (!names || names.length === 0) return {};
    const key = names.map(normalizeName).join(">");
    let path = resolved.get(key);
    if (!path) { path = await ensurePath(names, nodes); resolved.set(key, path); }
    return { categoryId: new Types.ObjectId(path[path.length - 1].id), categoryPath: path.map((node) => new Types.ObjectId(node.id)), ...derivedFields(path) };
  };

  const ops: object[] = [];
  for (const item of plan.toCreate) {
    ops.push({ insertOne: { document: withSearchText({ sku: item.sku, ...item.data, ...(await categoryData(item.data)) }) } });
  }
  for (const item of plan.toUpdate) {
    const before = current.get(skuKeyOf(item.sku));
    const sku = before?.sku ?? item.sku;
    const extra = await categoryData(item.data);
    const merged = { sku, name: before?.name, brand: before?.brand, category: before?.category, subCategory: before?.subCategory, ...item.data, ...extra };
    ops.push({ updateOne: { filter: { skuKey: skuKeyOf(sku) }, update: { $set: { ...item.data, ...extra, searchText: withSearchText(merged).searchText } } } });
  }
  try {
    for (let i = 0; i < ops.length; i += BATCH) await ProductModel.bulkWrite(ops.slice(i, i + BATCH) as never, { ordered: false });
  } catch (error) {
    if ((error as { code?: number }).code === 11000) throw new ImportConflictError("Hubo un conflicto de SKU mientras se importaba (otro cambio simultáneo). Parte del archivo puede haberse aplicado: volvé a subirlo para completar lo que falte.");
    throw error;
  }
  return { created: plan.toCreate.length, updated: plan.toUpdate.length };
}
```

(Importante: conservar el texto original del mensaje de `ImportConflictError` que ya existe en el archivo; si difiere del de arriba, mantener el original.)

Reemplazar `src/lib/import/run.ts` completo por:

```ts
import { loadNodes } from "@/lib/category-store";
import { missingPaths } from "@/lib/category-tree";
import { skuKeyOf } from "@/lib/product-schema";
import { ProductModel } from "@/models/Product";
import { applyImport } from "./apply";
import { importPathNames } from "./category-path";
import { parseRows, RawRow, RowError } from "./parse-rows";
import { planImport } from "./plan";

export type ImportResult = { mode: "preview" | "apply"; created: number; updated: number; errors: RowError[]; newCategories: string[] };

export async function runImport(rows: RawRow[], mode: "preview" | "apply"): Promise<ImportResult> {
  const { valid, errors: rowErrors } = parseRows(rows);
  const existing = await ProductModel.find({ skuKey: { $in: valid.map((r) => skuKeyOf(r.sku)) } }, "sku").lean();
  const plan = planImport(valid, new Set(existing.map((p) => String(p.sku))));
  const errors = [...rowErrors, ...plan.errors].sort((a, b) => a.rowNumber - b.rowNumber);
  const wanted = [...plan.toCreate, ...plan.toUpdate].map((item) => importPathNames(item.data)).filter((names): names is string[] => !!names && names.length > 0);
  const newCategories = missingPaths(await loadNodes(), wanted);
  const counts = mode === "apply" ? await applyImport(plan) : { created: plan.toCreate.length, updated: plan.toUpdate.length };
  return { mode, ...counts, errors, newCategories };
}
```

En `src/lib/import/run.test.ts`: agregar `import { CategoryNodeModel } from "@/models/CategoryNode";` y cambiar la limpieza para borrar también los nodos: en `afterAll` y `beforeEach`, junto a `ProductModel.deleteMany({})` agregar `CategoryNodeModel.deleteMany({})`; y en `beforeAll` agregar `await CategoryNodeModel.syncIndexes();` después de `await ProductModel.syncIndexes();`.

En `src/components/admin/import-tab.tsx`:
1. Cambiar el tipo: `type Result = { mode: "preview" | "apply"; created: number; updated: number; errors: { rowNumber: number; message: string }[]; columns: string[]; newCategories?: string[] };`
2. Dentro del bloque `{result ? <div> ... </div> : null}`, justo después de la línea con `<p><strong>{result.mode === "apply" ? ...` agregar:

```tsx
      {result.newCategories && result.newCategories.length > 0 ? <details className="new-categories">
        <summary>{result.mode === "apply" ? "Se crearon" : "Se van a crear"} {result.newCategories.length} categorías nuevas</summary>
        <ul>{result.newCategories.slice(0, 200).map((path) => <li key={path}>{path}</li>)}</ul>
      </details> : null}
```
3. Actualizar el texto de ayuda: reemplazar `Categoría, Subcategoría,` por `Categoría (con subniveles así: Climatización > Aires acondicionados > Split),` dentro del `<small>` descriptivo.

- [ ] **Step 4: Correr las pruebas y ver que pasan**

Run: `npx vitest run src/lib/import && npx tsc --noEmit`
Expected: PASS (incluidas las pruebas viejas de importación) y sin errores de tipos.

- [ ] **Step 5: Commit**

```bash
git add src/lib/import src/components/admin/import-tab.tsx
git commit -m "Importación: la categoría acepta el camino completo y crea las categorías que falten

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Exportación con el camino completo

**Files:**
- Modify: `src/lib/category-tree.ts` (agregar `productPathText`)
- Modify: `src/lib/category-tree.test.ts` (agregar pruebas)
- Modify: `src/app/api/admin/export/route.ts`

**Interfaces:**
- Consumes: `loadNodes` (Tarea 3), `nodePath`, `formatPath` (Tarea 1).
- Produces: `productPathText(nodes: CategoryNodeData[], product: { categoryId?: unknown; category?: string; subCategory?: string }): string`.

- [ ] **Step 1: Escribir las pruebas que fallan**

Agregar al final de `src/lib/category-tree.test.ts` (y agregar `productPathText` a la lista de imports del principio):

```ts
describe("productPathText", () => {
  it("usa el camino del árbol si el artículo tiene categoryId", () => {
    expect(productPathText(sample, { categoryId: "3", category: "viejo" })).toBe("Climatización > Aires acondicionados > Split");
  });
  it("sin categoryId usa las copias category y subCategory", () => {
    expect(productPathText(sample, { category: "Hogar", subCategory: "Bazar" })).toBe("Hogar > Bazar");
    expect(productPathText(sample, { category: "Hogar" })).toBe("Hogar");
  });
  it("con un categoryId que ya no existe cae a las copias", () => {
    expect(productPathText(sample, { categoryId: "999", category: "Hogar" })).toBe("Hogar");
  });
  it("acepta ids que no son texto (ObjectId)", () => {
    expect(productPathText(sample, { categoryId: { toString: () => "3" } })).toBe("Climatización > Aires acondicionados > Split");
  });
});
```

- [ ] **Step 2: Correr la prueba y ver que falla**

Run: `npx vitest run src/lib/category-tree.test.ts`
Expected: FAIL (`productPathText is not a function`).

- [ ] **Step 3: Implementar**

Agregar al final de `src/lib/category-tree.ts`:

```ts
/** Camino en texto (`A > B > C`) de un artículo: del árbol si está convertido; si no, de sus copias category y subCategory. */
export function productPathText(nodes: CategoryNodeData[], product: { categoryId?: unknown; category?: string; subCategory?: string }): string {
  const fromTree = product.categoryId ? nodePath(nodes, String(product.categoryId)) : [];
  if (fromTree.length > 0) return formatPath(fromTree);
  return [product.category, product.subCategory].filter(Boolean).join(" > ");
}
```

En `src/app/api/admin/export/route.ts`:
1. Agregar imports: `import { loadNodes } from "@/lib/category-store";` y `import { productPathText } from "@/lib/category-tree";`.
2. En `COLUMNS`, reemplazar `["Categoría", "category"], ["Subcategoría", "subCategory"],` por `["Categoría", "categoryPath"],`.
3. Después de `const products = await ProductModel.find({}).sort({ sku: 1 }).lean();` agregar `const nodes = await loadNodes();`.
4. Dentro del `sheet.addRow(COLUMNS.map(([, key]) => {`, como primera línea del callback agregar:

```ts
      if (key === "categoryPath") return productPathText(nodes, p as { categoryId?: unknown; category?: string; subCategory?: string });
```

- [ ] **Step 4: Correr pruebas y verificar la exportación**

Run: `npx vitest run src/lib/category-tree.test.ts && npx tsc --noEmit` — Expected: PASS.

Verificación a mano (servidor local y sesión de admin como en la Tarea 4):

```bash
curl -s -b $J "$B/export?format=csv" | head -3
```
Expected: encabezado con `Categoría` (una sola columna, sin `Subcategoría`) y filas con caminos tipo `Hogar > Bazar` o `Hogar`.

Ida y vuelta: subir ese mismo CSV en vista previa debe dar `0 categorías nuevas`:

```bash
curl -s -b $J "$B/export?format=csv" -o /tmp/claude-1000/export.csv
curl -s -b $J -F "file=@/tmp/claude-1000/export.csv" -F "mode=preview" $B/import | python3 -c 'import json,sys;d=json.load(sys.stdin);print("nuevos:",d["created"],"| a modificar:",d["updated"],"| errores:",len(d["errors"]),"| categorías nuevas:",len(d["newCategories"]))'
```
Expected: `nuevos: 0`, `a modificar: <total>`, `errores: 0`, `categorías nuevas: 0`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/category-tree.ts src/lib/category-tree.test.ts src/app/api/admin/export/route.ts
git commit -m "Exportación: la columna Categoría trae el camino completo

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Convertidor de Contabilium con caminos y árbol propuesto

**Files:**
- Create: `scripts/arbol-categorias.mjs`
- Modify: `scripts/contabilium-convertir.mjs`
- Modify: `docs/superpowers/specs/2026-11-19-categorias-multinivel-design.md` (§6)

**Interfaces:**
- Consumes: la columna Categoría con caminos (Tarea 7). Los datos están en `datos-contabilium/articulos.json` (generado por `npm run contabilium:traer`).
- Produces: `rutaDe(categoriaPlana: string, nombre: string): string[]` (camino propuesto) en `scripts/arbol-categorias.mjs`; el Excel `datos-contabilium/importar-catalogo.xlsx` con caminos y el informe `datos-contabilium/informe-importacion.txt` con una sección **ÁRBOL PROPUESTO** (cantidades por rama).

- [ ] **Step 1: Crear el árbol propuesto**

Crear `scripts/arbol-categorias.mjs`:

```js
// Árbol de categorías propuesto. Convierte las categorías planas que arma el convertidor en caminos de varios niveles.
// El usuario lo revisa en el informe antes de importar y después lo corrige desde el admin.

export const RUTA_POR_CATEGORIA = {
  "Aires acondicionados": ["Climatización", "Aires acondicionados"],
  "Calefacción": ["Climatización", "Calefacción"],
  "Ventiladores": ["Climatización", "Ventiladores"],
  "Climatización": ["Climatización"],

  "Heladeras y freezers": ["Línea blanca", "Heladeras y freezers"],
  "Lavarropas": ["Línea blanca", "Lavarropas"],
  "Cocinas y hornos": ["Línea blanca", "Cocinas y hornos"],
  "Microondas": ["Línea blanca", "Microondas"],
  "Termotanques": ["Línea blanca", "Termotanques"],

  "Pequeños electrodomésticos": ["Pequeños electrodomésticos"],
  "Planchas": ["Pequeños electrodomésticos", "Planchas"],
  "Aspiradoras y limpieza": ["Pequeños electrodomésticos", "Aspiradoras y limpieza"],

  "Televisores": ["TV, audio y tecnología", "Televisores"],
  "Audio": ["TV, audio y tecnología", "Audio"],
  "Informática": ["TV, audio y tecnología", "Informática"],
  "Celulares": ["TV, audio y tecnología", "Celulares"],

  "Bazar": ["Hogar", "Bazar"],
  "Muebles": ["Hogar", "Muebles"],
  "Textil y blanco": ["Hogar", "Textil y blanco"],
  "Iluminación": ["Hogar", "Iluminación"],

  "Cuidado personal": ["Belleza y cuidado personal"],

  "Herramientas": ["Herramientas y jardín", "Herramientas"],
  "Jardín, playa y camping": ["Herramientas y jardín", "Jardín, playa y camping"],

  "Bebés y niños": ["Bebés, niños y juegos", "Bebés y niños"],
  "Juguetes": ["Bebés, niños y juegos", "Juguetes"],

  "Bicicletas y rodados": ["Movilidad", "Bicicletas y rodados"],
  "Motos": ["Movilidad", "Motos"],

  "Otros": ["Otros"]
};

const sinTildes = (texto) => texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Camino propuesto para un artículo: por su categoría plana y, en los aires acondicionados, por palabras del nombre. */
export function rutaDe(categoriaPlana, nombre) {
  const base = RUTA_POR_CATEGORIA[categoriaPlana] ?? [categoriaPlana];
  if (categoriaPlana === "Aires acondicionados") {
    const texto = sinTildes(nombre);
    if (/\bsplit\b/.test(texto)) return [...base, "Split"];
    if (/\bportatil\b/.test(texto)) return [...base, "Portátil"];
    if (/\bventana\b/.test(texto)) return [...base, "Ventana"];
  }
  return base;
}
```

- [ ] **Step 2: Usar los caminos en el convertidor**

En `scripts/contabilium-convertir.mjs`:
1. Agregar al principio, con los demás imports: `import { rutaDe } from "./arbol-categorias.mjs";`
2. Justo después de la línea `const category = categoryOf(rawUpper, rawUpper.trim().split(/\s+/)[0] ?? "");` agregar: `const ruta = rutaDe(category, name).join(" > ");`
3. En el `rows.push({ ... })` de cada artículo, cambiar el campo `category,` por `category: ruta,`.
4. Cambiar `stats.categorias.set(category, (stats.categorias.get(category) ?? 0) + 1);` por `stats.categorias.set(ruta, (stats.categorias.get(ruta) ?? 0) + 1);` (la línea `if (category === "Otros") stats.otros.push(shown);` queda igual: usa la categoría plana).
5. En el armado del informe, reemplazar la línea `"CATEGORÍAS", ...sorted(stats.categorias).map(([k, v]) => \`  ${k}: ${v}\`), "",` por:

```js
    "ÁRBOL PROPUESTO (cantidad de artículos por rama, incluye lo que hay debajo)", ...arbolLineas(rows), "",
```
6. Agregar esta función antes de `async function main()`:

```js
/** Líneas del árbol con cantidades acumuladas por rama. */
function arbolLineas(rows) {
  const conteo = new Map();
  for (const row of rows) {
    const partes = row.category.split(" > ");
    for (let largo = 1; largo <= partes.length; largo++) {
      const clave = partes.slice(0, largo).join(" > ");
      conteo.set(clave, (conteo.get(clave) ?? 0) + 1);
    }
  }
  return [...conteo.keys()].sort((a, b) => a.localeCompare(b, "es")).map((clave) => {
    const partes = clave.split(" > ");
    return `${"  ".repeat(partes.length)}${partes[partes.length - 1]}: ${conteo.get(clave)}`;
  });
}
```

- [ ] **Step 3: Correr el convertidor y revisar el árbol**

Run: `cd "/home/mati/Escritorio/Proyectos electronorte/catalogo-electronorte" && node scripts/contabilium-convertir.mjs --descuento-efectivo 15 | sed -n 1,60p`
Expected: informe con el bloque **ÁRBOL PROPUESTO** (por ejemplo `Climatización: N`, debajo `Aires acondicionados: N` y con sangría `Split: N`, `Portátil: N`, `Ventana: N`), el total de artículos igual al de antes (2385) y ningún error. Verificar que la suma de las ramas de primer nivel da el total.

- [ ] **Step 4: Probar la importación en local (vista previa)**

```bash
curl -s -b $J -F "file=@datos-contabilium/importar-catalogo.xlsx" -F "mode=preview" $B/import | python3 -c 'import json,sys;d=json.load(sys.stdin);print("a modificar:",d["updated"],"| errores:",len(d["errors"]),"| categorías nuevas:",len(d["newCategories"]));print(d["newCategories"][:8])'
```
Expected: `errores: 0` y la lista de categorías nuevas con caminos de varios niveles. **No aplicar todavía**: el usuario revisa el árbol primero.

- [ ] **Step 5: Actualizar el spec (§6) y commitear**

En `docs/superpowers/specs/2026-11-19-categorias-multinivel-design.md`, en la sección 6, reemplazar el párrafo que empieza con `**Árbol inicial (lo arma Claude):**` por:

```
- **Árbol inicial (lo arma Claude):** `scripts/arbol-categorias.mjs` agrupa las 28 categorías en ~10 principales y baja un nivel más en los aires acondicionados (Split, Portátil, Ventana, por palabras del nombre). El convertidor de Contabilium escribe los caminos en el Excel y **muestra el árbol propuesto con cantidades por rama en el informe, antes de importar**. Se aplica importando el Excel (vista previa primero); después el usuario lo corrige desde el admin.
```

```bash
git add scripts/arbol-categorias.mjs scripts/contabilium-convertir.mjs docs/superpowers/specs/2026-11-19-categorias-multinivel-design.md
git commit -m "Contabilium: el convertidor escribe caminos de categoría y muestra el árbol propuesto

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

# ETAPA 3: Tienda (direcciones por camino, listado, migas, SEO)

### Task 10: Filtro por rama y subcategorías con cantidades

**Files:**
- Modify: `src/lib/category-tree.ts` (agregar `childrenWithCounts`, `legacyCategoryHref`, `CategoryChild`)
- Modify: `src/lib/category-tree.test.ts`
- Modify: `src/lib/catalog-filters.ts`
- Modify: `src/lib/catalog-filters.test.ts`
- Modify: `src/lib/catalog-query.ts`

**Interfaces:**
- Consumes: `CategoryNodeData`, `compareNames`, `findByName`, `nodePath`, `categoryHref` (Tarea 1); `loadNodes` (Tarea 3).
- Produces:
  - `type CategoryChild = { id: string; name: string; slug: string; count: number }`
  - `childrenWithCounts(nodes: CategoryNodeData[], parentId: string | null, counts: Record<string, number>): CategoryChild[]`
  - `legacyCategoryHref(nodes: CategoryNodeData[], category: string, subCategory?: string): string | null`
  - `CatalogFilters.categoryId: string` (parámetro `cat` en la dirección; `""` si no hay)
  - `CatalogResult.facets.categoryChildren: CategoryChild[]`

- [ ] **Step 1: Escribir las pruebas que fallan**

Agregar al final de `src/lib/category-tree.test.ts` (y sumar `childrenWithCounts` y `legacyCategoryHref` a los imports):

```ts
describe("childrenWithCounts", () => {
  const counts = { "1": 10, "2": 6, "3": 4, "4": 0, "5": 4, "6": 2, "7": 1 };
  it("hijos con artículos, ordenados, con su cantidad", () => {
    expect(childrenWithCounts(sample, "1", counts).map((c) => [c.name, c.count])).toEqual([["Aires acondicionados", 6], ["Calefacción", 4]]);
  });
  it("sin padre son las categorías de primer nivel (Otros al final)", () => {
    expect(childrenWithCounts(sample, null, counts).map((c) => c.name)).toEqual(["Climatización", "Hogar", "Otros"]);
  });
  it("omite los que no tienen artículos", () => {
    expect(childrenWithCounts(sample, "2", counts).map((c) => c.name)).toEqual(["Split"]);
  });
});

describe("legacyCategoryHref", () => {
  it("resuelve nombres viejos sin distinguir tildes ni mayúsculas", () => {
    expect(legacyCategoryHref(sample, "CLIMATIZACION")).toBe("/catalogo/climatizacion");
    expect(legacyCategoryHref(sample, "climatización", "aires  acondicionados")).toBe("/catalogo/climatizacion/aires-acondicionados");
  });
  it("subcategoría desconocida lleva a la categoría", () => {
    expect(legacyCategoryHref(sample, "Climatización", "No existe")).toBe("/catalogo/climatizacion");
  });
  it("categoría desconocida o vacía da null", () => {
    expect(legacyCategoryHref(sample, "No existe")).toBeNull();
    expect(legacyCategoryHref(sample, "  ")).toBeNull();
  });
});
```

Agregar a `src/lib/catalog-filters.test.ts`: (a) en **cada** objeto esperado de `CatalogFilters` (buscar los literales que contienen `outletOnly:`) agregar `categoryId: ""`; (b) estos casos nuevos dentro del `describe` principal (agregar `import { Types } from "mongoose";` si hace falta):

```ts
  it("categoryId: acepta un id válido y descarta el resto", () => {
    expect(parseFilters(new URLSearchParams(`cat=${"a".repeat(24)}`)).categoryId).toBe("a".repeat(24));
    expect(parseFilters(new URLSearchParams("cat=xyz")).categoryId).toBe("");
    expect(parseFilters(new URLSearchParams()).categoryId).toBe("");
  });
  it("categoryId se serializa como cat y filtra por la rama", () => {
    const f = { ...parseFilters(new URLSearchParams()), categoryId: "a".repeat(24) };
    expect(serializeFilters(f).get("cat")).toBe("a".repeat(24));
    expect(buildMatch(f).categoryPath).toEqual(new Types.ObjectId("a".repeat(24)));
    expect(buildMatch(f, "category")).not.toHaveProperty("categoryPath");
  });
```

- [ ] **Step 2: Correr las pruebas y ver que fallan**

Run: `npx vitest run src/lib/category-tree.test.ts src/lib/catalog-filters.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar**

Agregar al final de `src/lib/category-tree.ts`:

```ts
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
```

En `src/lib/catalog-filters.ts`:
1. Agregar al principio `import { Types } from "mongoose";`.
2. En el tipo `CatalogFilters`, agregar `categoryId: string;` (por ejemplo después de `subCategory: string;`).
3. En `parseFilters`, dentro del objeto devuelto, después de la línea de `subCategory`, agregar: `categoryId: /^[a-f0-9]{24}$/.test(params.get("cat") ?? "") ? (params.get("cat") as string) : "",`
4. En `serializeFilters`, después de la línea de `subCategory`, agregar: `if (f.categoryId) p.set("cat", f.categoryId);`
5. En `buildMatch`, después de la línea `if (omit !== "category" && omit !== "subCategory" && f.subCategory) match.subCategory = f.subCategory;`, agregar: `if (omit !== "category" && omit !== "subCategory" && f.categoryId) match.categoryPath = new Types.ObjectId(f.categoryId);`

En `src/lib/catalog-query.ts`:
1. Agregar imports: `import { loadNodes } from "@/lib/category-store";` y `import { childrenWithCounts, type CategoryChild } from "@/lib/category-tree";`
2. En el tipo `CatalogResult`, dentro de `facets`, agregar `categoryChildren: CategoryChild[];`
3. En `runCatalogQuery`, cambiar `const [rows, [facets]] = await Promise.all([` por `const [rows, [facets], nodes] = await Promise.all([` y agregar `loadNodes()` como tercer elemento del arreglo (después del `ProductModel.aggregate([...])`).
4. Dentro del `$facet`, agregar: `nodeCounts: [{ $match: buildMatch(f) }, { $unwind: "$categoryPath" }, { $group: { _id: "$categoryPath", count: { $sum: 1 } } }],`
5. En el `facets: {` del resultado, agregar: `categoryChildren: childrenWithCounts(nodes, f.categoryId || null, Object.fromEntries((facets.nodeCounts as { _id: unknown; count: number }[]).map((row) => [String(row._id), row.count]))),`

- [ ] **Step 4: Correr pruebas y tipos**

Run: `npx vitest run src/lib && npx tsc --noEmit`
Expected: PASS y sin errores de tipos (los componentes que construyen `CatalogFilters` a mano se arreglan en la Tarea 12; si `tsc` los marca, anotar y seguir).

- [ ] **Step 5: Commit**

```bash
git add src/lib/category-tree.ts src/lib/category-tree.test.ts src/lib/catalog-filters.ts src/lib/catalog-filters.test.ts src/lib/catalog-query.ts
git commit -m "Catálogo: filtro por rama del árbol y subcategorías con cantidades

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Ruta `/catalogo/[[...path]]`, redirecciones, migas y SEO

**Files:**
- Move: `src/app/catalogo/page.tsx` → `src/app/catalogo/[[...path]]/page.tsx`
- Create: `src/components/breadcrumb.tsx`
- Modify: `src/app/globals.css` o `src/app/interaction.css` (estilo de la miga)

**Interfaces:**
- Consumes: `loadNodes` (Tarea 3); `resolveSlugs`, `nodePath`, `categoryHref`, `legacyCategoryHref` (Tareas 1 y 10); `parseFilters`, `serializeFilters`, `runCatalogQuery` (Tarea 10); `breadcrumbJsonLd` y `JsonLd` existentes (`src/lib/seo.ts`, `src/components/json-ld.tsx`); `siteUrl`.
- Produces:
  - `<Breadcrumb trail={{ name: string; href?: string }[]} />`
  - `type CatalogNode = { id: string; name: string; pathSlugs: string[]; trail: { name: string; href: string }[] }` (se define y exporta en `src/components/catalog.tsx` en la Tarea 12; esta tarea la importa).
  - Comportamiento: `/catalogo/<camino>` lista la rama; un camino inexistente da 404; `/catalogo?category=X[&subCategory=Y]` redirige 308 a la dirección por camino si la categoría existe en el árbol; si no existe, muestra el catálogo con el filtro viejo.

- [ ] **Step 1: Crear la miga de pan**

Crear `src/components/breadcrumb.tsx`:

```tsx
import Link from "next/link";

export type Crumb = { name: string; href?: string };

export function Breadcrumb({ trail }: { trail: Crumb[] }) {
  return <nav className="product-breadcrumb" aria-label="Migas de pan">
    {trail.map((crumb, index) => <span className="crumb" key={`${crumb.name}-${index}`}>
      {crumb.href ? <Link href={crumb.href}>{crumb.name}</Link> : <b>{crumb.name}</b>}
      {index < trail.length - 1 ? <span aria-hidden="true">›</span> : null}
    </span>)}
  </nav>;
}
```

Agregar al final de `src/app/interaction.css`:

```css
.product-breadcrumb .crumb{display:inline-flex;align-items:center;gap:10px;min-width:0}
```

- [ ] **Step 2: Mover y reescribir la página del catálogo**

```bash
mkdir -p "src/app/catalogo/[[...path]]" && git mv src/app/catalogo/page.tsx "src/app/catalogo/[[...path]]/page.tsx"
```

Reemplazar el contenido de `src/app/catalogo/[[...path]]/page.tsx` por:

```tsx
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { Suspense } from "react";
import { Catalog, type CatalogNode } from "@/components/catalog";
import { JsonLd } from "@/components/json-ld";
import { parseFilters, serializeFilters } from "@/lib/catalog-filters";
import { runCatalogQuery } from "@/lib/catalog-query";
import { loadNodes } from "@/lib/category-store";
import { categoryHref, legacyCategoryHref, nodePath, resolveSlugs } from "@/lib/category-tree";
import { connectDb } from "@/lib/db";
import { breadcrumbJsonLd } from "@/lib/seo";
import { siteUrl } from "@/lib/site-url";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type Params = Promise<{ path?: string[] }>;

function toQuery(params: Record<string, string | string[] | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) query.append(key, item);
  return query;
}

export async function generateMetadata({ params, searchParams }: { params: Params; searchParams: SearchParams }): Promise<Metadata> {
  const slugs = (await params).path ?? [];
  const query = await searchParams;
  await connectDb();
  const nodes = await loadNodes();
  const node = slugs.length ? resolveSlugs(nodes, slugs) : null;
  if (slugs.length && !node) return { title: "Categoría no encontrada", robots: { index: false } };
  const legacy = typeof query.category === "string" ? query.category.slice(0, 80) : "";
  const name = node?.name ?? legacy;
  const filtered = Object.keys(query).some((key) => key !== "page");
  const title = name ? `${name}: precios, cuotas y consulta por WhatsApp` : "Catálogo de electrodomésticos y tecnología";
  const description = name
    ? `Mirá ${name.toLowerCase()} en Electronorte, Los Polvorines. Precio en efectivo, cuotas sin interés y consulta directa por WhatsApp.`
    : "Todo el catálogo de Electronorte: electrodomésticos, tecnología y hogar con precio en efectivo, cuotas sin interés y consulta por WhatsApp.";
  return {
    title,
    description,
    alternates: { canonical: node ? categoryHref(nodePath(nodes, node.id)) : "/catalogo" },
    ...(filtered ? { robots: { index: false, follow: true } } : {})
  };
}

export default async function CatalogPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const slugs = (await params).path ?? [];
  const query = toQuery(await searchParams);
  await connectDb();
  const nodes = await loadNodes();
  const node = slugs.length ? resolveSlugs(nodes, slugs) : null;
  if (slugs.length && !node) notFound();

  // enlaces viejos ?category=… → dirección por camino (si la categoría ya existe en el árbol)
  const legacyName = (query.get("category") ?? "").trim();
  if (!slugs.length && legacyName) {
    const target = legacyCategoryHref(nodes, legacyName, query.get("subCategory") ?? "");
    if (target) {
      query.delete("category");
      query.delete("subCategory");
      const rest = query.toString();
      permanentRedirect(`${target}${rest ? `?${rest}` : ""}`);
    }
  }

  const filters = { ...parseFilters(query), categoryId: node?.id ?? "" };
  // la primera página de resultados llega ya armada: sin espera en blanco ni saltos al cargar
  let initialResult = null;
  try {
    initialResult = JSON.parse(JSON.stringify(await runCatalogQuery(filters)));
  } catch {
    initialResult = null;
  }
  const trail = node ? nodePath(nodes, node.id) : [];
  const catalogNode: CatalogNode | null = node
    ? { id: node.id, name: node.name, pathSlugs: trail.map((item) => item.slug), trail: trail.map((item, index) => ({ name: item.name, href: categoryHref(trail.slice(0, index + 1)) })) }
    : null;
  const base = siteUrl();
  return <>
    {catalogNode ? <JsonLd data={breadcrumbJsonLd(base, [{ name: "Inicio", path: "/" }, { name: "Catálogo", path: "/catalogo" }, ...catalogNode.trail.map((crumb) => ({ name: crumb.name, path: crumb.href }))])} /> : null}
    <Suspense fallback={<p className="catalog-loading" role="status">Cargando catálogo…</p>}>
      <Catalog key={node?.id ?? "todos"} node={catalogNode} initialResult={initialResult} initialQuery={serializeFilters(filters).toString()} />
    </Suspense>
  </>;
}
```

(El tipo `CatalogNode` lo exporta `catalog.tsx` en la Tarea 12; hasta entonces `tsc` marcará ese import: seguir con la Tarea 12 antes de verificar.)

- [ ] **Step 3: Commit parcial**

```bash
git add src/components/breadcrumb.tsx src/app/interaction.css "src/app/catalogo"
git commit -m "Catálogo: ruta por camino con redirección de enlaces viejos, migas y SEO (parte 1)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Listado y filtros navegan por la rama

**Files:**
- Modify: `src/components/catalog.tsx`
- Modify: `src/components/catalog-filters-panel.tsx`
- Modify: `src/app/interaction.css`

**Interfaces:**
- Consumes: `Breadcrumb` (Tarea 11), `categoryHref` (Tarea 1), `CatalogFilters` con `categoryId` y `facets.categoryChildren` (Tarea 10).
- Produces: `export type CatalogNode = { id: string; name: string; pathSlugs: string[]; trail: { name: string; href: string }[] }`; `Catalog` acepta `node?: CatalogNode | null`; `CatalogFiltersPanel` acepta `node` y `suffix`.

- [ ] **Step 1: Cambiar `catalog.tsx`**

1. Agregar imports: `import { Breadcrumb } from "./breadcrumb";` y `import { categoryHref } from "@/lib/category-tree";`.
2. Antes de `export function Catalog(`, agregar:

```tsx
export type CatalogNode = { id: string; name: string; pathSlugs: string[]; trail: { name: string; href: string }[] };
```

3. Cambiar la firma: `export function Catalog({ node = null, initialResult = null, initialQuery = "" }: { node?: CatalogNode | null; initialResult?: CatalogResult | null; initialQuery?: string }) {`
4. Reemplazar `const filters = parseFilters(new URLSearchParams(searchParams.toString()));` por:

```tsx
  const filters = { ...parseFilters(new URLSearchParams(searchParams.toString())), categoryId: node?.id ?? "" };
  const basePath = node ? categoryHref(node.pathSlugs.map((slug) => ({ slug }))) : "/catalogo";
  const parentHref = node && node.pathSlugs.length > 1 ? categoryHref(node.pathSlugs.slice(0, -1).map((slug) => ({ slug }))) : "/catalogo";
  const linkSuffix = serializeFilters({ ...filters, categoryId: "", category: "", subCategory: "", page: 1 }).toString();
```

5. Reemplazar la función `update` completa por (los filtros dentro de la misma categoría cambian la dirección sin recargar la página; la categoría va en el camino y no en los parámetros):

```tsx
  function update(patch: Partial<CatalogFilters>) {
    const next = { ...filters, page: 1, ...patch, categoryId: "" };
    const qs = serializeFilters(next).toString();
    window.history.pushState(null, "", qs ? `${basePath}?${qs}` : basePath);
  }
```

6. En la lista de chips, después de la línea `if (filters.q) chips.push(...)`, agregar: `if (node) chips.push({ label: node.name, remove: () => router.push(parentHref) });`
7. En el título, reemplazar `{filters.category || (filters.outletOnly ? "Outlet" : "Todos los productos")}` por `{node?.name || filters.category || (filters.outletOnly ? "Outlet" : "Todos los productos")}`.
8. Justo antes de ese `<h1>` (dentro de `.section-head`), agregar: `{node ? <Breadcrumb trail={[{ name: "Inicio", href: "/" }, { name: "Catálogo", href: "/catalogo" }, ...node.trail.slice(0, -1), { name: node.name }]} /> : null}`
9. En la llamada `<CatalogFiltersPanel ... />`, agregar las props `node={node} suffix={linkSuffix}`.

- [ ] **Step 2: Cambiar el panel de filtros**

En `src/components/catalog-filters-panel.tsx`:
1. Agregar imports: `import Link from "next/link";`, `import { categoryHref } from "@/lib/category-tree";` y `import type { CatalogNode } from "./catalog";`.
2. En `Props` agregar `node: CatalogNode | null; suffix: string;` y en la firma `{ filters, facets, open, onChange, node, suffix }`.
3. Dentro de la función, antes del `return`, agregar:

```tsx
  const hrefFor = (slugs: string[]) => `${categoryHref(slugs.map((slug) => ({ slug })))}${suffix ? `?${suffix}` : ""}`;
  const legacy = !node && facets !== undefined && facets.categoryChildren.length === 0;
```

4. Reemplazar el bloque de categorías (desde `<p>Categorías</p>` hasta el cierre del bloque `{filters.category ? facets?.subCategories.map(...) : null}`) por:

```tsx
    <p>Categorías</p>
    {node ? <Link className="facet-back" href={hrefFor(node.pathSlugs.slice(0, -1))}>← {node.pathSlugs.length > 1 ? node.trail[node.trail.length - 2].name : "Todas las categorías"}</Link> : null}
    {node ? <b className="facet-current">{node.name}</b> : null}
    {facets?.categoryChildren.map((child) => (
      <Link key={child.id} className="facet-sub-link" href={hrefFor([...(node?.pathSlugs ?? []), child.slug])}>{child.name}<span>{child.count}</span></Link>
    ))}
    {legacy ? <>
      {filters.category ? <button type="button" className="facet-back" onClick={() => onChange({ category: "", subCategory: "" })}>← Todas las categorías</button> : null}
      {facets?.categories.filter((c) => !filters.category || c.value === filters.category).map((c) => (
        <button type="button" key={c.value} className={filters.category === c.value ? "selected" : ""} onClick={() => onChange({ category: c.value, subCategory: "" })}>
          {c.value}<span>{c.count}</span>
        </button>
      ))}
      {filters.category ? facets?.subCategories.map((s) => (
        <button type="button" key={s.value} className={`facet-sub${filters.subCategory === s.value ? " selected" : ""}`} onClick={() => onChange({ subCategory: filters.subCategory === s.value ? "" : s.value })}>
          {s.value}<span>{s.count}</span>
        </button>
      )) : null}
    </> : null}
```

(El bloque `legacy` mantiene la tienda funcionando mientras haya artículos sin convertir.)

- [ ] **Step 3: Estilos**

Agregar al final de `src/app/interaction.css`:

```css
.filters-panel a.facet-sub-link,.filters-panel a.facet-back{display:flex;align-items:center;gap:8px;padding:10px 0;border-bottom:1px solid var(--line);color:var(--text);text-decoration:none;font-size:14px;font-weight:600}
.filters-panel a.facet-sub-link span{margin-left:auto;color:var(--muted);font-size:12px;font-weight:500}
.filters-panel a.facet-sub-link:hover{color:var(--brand)}
.filters-panel a.facet-back{color:var(--brand);font-weight:800;font-size:13px}
.filters-panel .facet-current{display:block;padding:10px 0;font-size:15px;border-bottom:1px solid var(--line)}
```

- [ ] **Step 4: Verificar en el navegador**

Con la conversión de la Tarea 6 aplicada y el Excel de la Tarea 9 ya importado en local (si todavía no, crear Climatización › Aires acondicionados › Split desde el admin y asignarles artículos):

```bash
npx tsc --noEmit
for u in /catalogo /catalogo/climatizacion /catalogo/climatizacion/aires-acondicionados /catalogo/no-existe "/catalogo?category=Cocinas%20y%20hornos"; do curl -s -o /dev/null -w "$u -> %{http_code} %{redirect_url}\n" "http://localhost:3000$u"; done
```
Expected: `200` para las tres primeras; `404` para `/catalogo/no-existe`; `308` con `redirect_url` a `/catalogo/<camino>` para el enlace viejo (o `200` si esa categoría ya no existe en el árbol).

Artículos sin convertir: con un nombre viejo que no existe en el árbol, el catálogo sigue mostrando el filtro viejo y no falla:

```bash
curl -s -o /dev/null -w "legacy: %{http_code}\n" "http://localhost:3000/catalogo?category=NoExisteEnElArbol"
curl -s "http://localhost:3000/api/products?category=Cocinas%20y%20hornos" | python3 -c 'import json,sys;print("artículos con el filtro viejo:",json.load(sys.stdin)["total"])'
```
Expected: `legacy: 200` (sin error 500) y un total mayor que 0 para la categoría vieja que sí tiene artículos.

En el navegador: abrir `/catalogo/climatizacion`: migas "Inicio › Catálogo", título "Climatización", a la izquierda las subcategorías con cantidad y "← Todas las categorías"; tocar una subcategoría cambia la dirección y la lista; marcar una marca cambia la dirección sin recargar la página; el chip de la categoría ("Climatización ×") sube un nivel. La consola no muestra errores ni avisos de hidratación.

- [ ] **Step 5: Commit**

```bash
git add src/components/catalog.tsx src/components/catalog-filters-panel.tsx src/app/interaction.css
git commit -m "Catálogo: el listado y los filtros navegan por la rama del árbol

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Enlaces de la home, ficha del artículo y mapa del sitio

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/components/home-page.tsx`
- Modify: `src/components/category-strip.tsx`
- Modify: `src/app/productos/[id]/page.tsx`
- Modify: `src/components/product-detail.tsx`
- Modify: `src/app/sitemap.ts`

**Interfaces:**
- Consumes: `loadNodes`, `countsByNode` (Tarea 3); `findByName`, `categoryHref`, `nodePath` (Tarea 1); `Breadcrumb` (Tarea 11).
- Produces: `HomePage` recibe `categoryHrefs: Record<string, string>` (nombre de categoría de primer nivel → dirección); `CategoryStrip` recibe `hrefFor: (name: string) => string`; `ProductDetail` recibe `trail: { name: string; href?: string }[]`.

- [ ] **Step 1: Home**

En `src/app/page.tsx`:
1. Agregar imports: `import { loadNodes } from "@/lib/category-store";` y `import { categoryHref, findByName } from "@/lib/category-tree";`.
2. Después de calcular `shelves` y `categoryTiles`, agregar:

```tsx
  const nodes = await loadNodes();
  const names = [...categoryTiles.map((tile) => tile.name), ...shelves.categories.map((shelf) => shelf.name)];
  const categoryHrefs: Record<string, string> = {};
  for (const name of names) {
    const root = findByName(nodes, null, name);
    if (root) categoryHrefs[name] = categoryHref([root]);
  }
```

3. Pasar `categoryHrefs={categoryHrefs}` a `<HomePage ... />`.

En `src/components/home-page.tsx`:
1. Agregar `categoryHrefs` a las props: `{ shelves, categoryTiles, homepage, featured, categoryHrefs }: { ...; categoryHrefs: Record<string, string> }`.
2. Dentro del componente, agregar `const hrefFor = (name: string) => categoryHrefs[name] ?? \`/catalogo?category=${encodeURIComponent(name)}\`;`
3. En el estante de cada categoría, reemplazar `href={\`/catalogo?category=${encodeURIComponent(shelf.name)}\`}` por `href={hrefFor(shelf.name)}`.
4. En `<CategoryStrip tiles={categoryTiles} />` pasar `hrefFor={hrefFor}`.

En `src/components/category-strip.tsx`: cambiar la firma a `{ tiles, hrefFor }: { tiles: CategoryTile[]; hrefFor: (name: string) => string }` y el enlace `href={\`/catalogo?category=${encodeURIComponent(tile.name)}\`}` por `href={hrefFor(tile.name)}`.

- [ ] **Step 2: Ficha del artículo**

En `src/app/productos/[id]/page.tsx`:
1. Agregar imports: `import { loadNodes } from "@/lib/category-store";` y `import { categoryHref, nodePath } from "@/lib/category-tree";`.
2. En `ProductPage`, después de `const base = siteUrl();`, agregar:

```tsx
  const nodes = await loadNodes();
  const path = product.categoryId ? nodePath(nodes, product.categoryId) : [];
  const trail = path.length > 0
    ? [{ name: "Inicio", href: "/" }, ...path.map((node, index) => ({ name: node.name, href: categoryHref(path.slice(0, index + 1)) })), { name: product.name }]
    : [{ name: "Inicio", href: "/" }, { name: product.category, href: `/catalogo?category=${encodeURIComponent(product.category)}` }, { name: product.name }];
```

3. Reemplazar la llamada a `breadcrumbJsonLd(base, [...])` por `breadcrumbJsonLd(base, trail.map((crumb) => ({ name: crumb.name, path: crumb.href ?? \`/productos/${product.id}\` })))`.
4. Pasar `trail={trail}` a `<ProductDetail product={product} trail={trail} />`.

En `src/components/product-detail.tsx`: agregar `import { Breadcrumb, type Crumb } from "./breadcrumb";`, agregar la prop `trail: Crumb[]` y reemplazar el `<nav className="product-breadcrumb">…</nav>` completo por `<Breadcrumb trail={trail} />`.

- [ ] **Step 3: Mapa del sitio**

En `src/app/sitemap.ts`:
1. Agregar imports: `import { countsByNode, loadNodes } from "@/lib/category-store";` y `import { categoryHref, nodePath } from "@/lib/category-tree";`.
2. Dentro del `try`, después de obtener `categories` y `products`, agregar:

```ts
    const [nodes, counts] = await Promise.all([loadNodes(), countsByNode(false)]);
    const treeUrls = nodes
      .filter((node) => (counts[node.id] ?? 0) > 0)
      .map((node) => ({ url: `${base}${categoryHref(nodePath(nodes, node.id))}`, changeFrequency: "daily" as const, priority: 0.8 }));
```

3. En el arreglo devuelto, reemplazar la línea `...categories.map(...)` por `...(treeUrls.length > 0 ? treeUrls : categories.map((name) => ({ url: \`${base}/catalogo?category=${encodeURIComponent(name)}\`, changeFrequency: "daily" as const, priority: 0.8 }))),`

- [ ] **Step 4: Verificar**

```bash
npx tsc --noEmit && npx vitest run
curl -s http://localhost:3000/sitemap.xml | grep -c "/catalogo/"
curl -s http://localhost:3000/ | grep -o 'href="/catalogo/[^"]*"' | sort -u | head
```
Expected: sin errores; el mapa del sitio trae direcciones `/catalogo/<camino>`; la home enlaza a `/catalogo/<slug>` en la tira y en los estantes. En el navegador, abrir un artículo: las migas muestran el camino completo (Inicio › Climatización › Aires acondicionados › Split › Nombre) y cada tramo lleva a su página.

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx src/components/home-page.tsx src/components/category-strip.tsx "src/app/productos/[id]/page.tsx" src/components/product-detail.tsx src/app/sitemap.ts
git commit -m "Tienda: la home, la ficha del artículo y el mapa del sitio usan las direcciones por camino

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

# ETAPA 4: Menú "Categorías" por niveles

### Task 14: Menú con pestaña de subcategorías

**Files:**
- Create: `src/lib/menu-tree.ts`
- Create: `src/components/category-menu.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/components/home-page.tsx`
- Modify: `src/app/interaction.css`

**Interfaces:**
- Consumes: `buildMenuTree`, `MenuNode` (Tarea 1); `loadNodes`, `countsByNode` (Tarea 3).
- Produces:
  - `getMenuTree(): Promise<MenuNode[]>` (con caché de 60 s y la etiqueta `category-tree`, que invalidan los cambios del admin de la Tarea 4).
  - `<CategoryMenu menu={MenuNode[]} />`.

Comportamiento (spec §10): el botón "Categorías" abre un panel; a la izquierda las categorías principales; **pasar el mouse o hacer clic sobre una de ellas abre su pestaña de subcategorías y no navega**; la pestaña muestra el nombre, el botón "Ver todo" (todos los artículos de la categoría padre) y columnas (subcategoría de segundo nivel en negrita, las de tercer nivel como enlaces, y "Ver todo" al final de cada columna). Una categoría sin subcategorías es un enlace directo. Esc, la ✕ y hacer clic afuera cierran el panel. En celular se entra por niveles con "← Volver".

- [ ] **Step 1: Datos del menú con caché**

Crear `src/lib/menu-tree.ts`:

```ts
import { unstable_cache } from "next/cache";
import { countsByNode, loadNodes } from "@/lib/category-store";
import { buildMenuTree } from "@/lib/category-tree";
import { connectDb } from "@/lib/db";

/** Árbol del menú (solo categorías con artículos). Se guarda 60 segundos y se renueva solo al editar categorías en el admin. */
export const getMenuTree = unstable_cache(
  async () => {
    await connectDb();
    const [nodes, counts] = await Promise.all([loadNodes(), countsByNode(false)]);
    return buildMenuTree(nodes, counts);
  },
  ["menu-tree"],
  { revalidate: 60, tags: ["category-tree"] }
);
```

- [ ] **Step 2: Componente del menú**

Crear `src/components/category-menu.tsx`:

```tsx
"use client";

import Link from "next/link";
import { KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";
import type { MenuNode } from "@/lib/category-tree";

const DESKTOP = "(min-width: 861px)";

export function CategoryMenu({ menu }: { menu: MenuNode[] }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const timer = useRef<number | undefined>(undefined);

  const close = useCallback((restoreFocus = false) => {
    window.clearTimeout(timer.current);
    setOpen(false);
    setActive(null);
    if (restoreFocus) trigger.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => { if (!box.current?.contains(event.target as Node)) close(); };
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") { event.stopPropagation(); close(true); return; }
      // en celular el panel ocupa toda la pantalla: el foco no sale de él mientras está abierto
      if (event.key === "Tab" && !window.matchMedia(DESKTOP).matches && box.current) {
        const items = [...box.current.querySelectorAll<HTMLElement>("button, a[href]")].filter((item) => item.offsetParent !== null);
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open, close]);

  if (menu.length === 0) return null;
  const current = menu.find((item) => item.id === active) ?? null;

  const toggle = () => {
    if (open) return close();
    const desktop = window.matchMedia(DESKTOP).matches;
    if (!desktop && trigger.current) box.current?.style.setProperty("--menu-top", `${Math.round(trigger.current.getBoundingClientRect().bottom)}px`);
    setOpen(true);
    setActive(desktop ? (menu.find((item) => item.children.length > 0)?.id ?? null) : null);
  };
  const hover = (id: string) => {
    if (!window.matchMedia(DESKTOP).matches) return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setActive(id), 90);
  };
  const onListKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const items = [...(box.current?.querySelectorAll<HTMLElement>(".menu-root") ?? [])];
    const index = items.indexOf(document.activeElement as HTMLElement);
    if (index < 0) return;
    event.preventDefault();
    items[(index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length].focus();
  };

  return <div className="category-menu" ref={box}>
    <button ref={trigger} type="button" className={`dropdown-trigger${open ? " active" : ""}`} aria-expanded={open} aria-controls="category-menu-panel" onClick={toggle}>
      <span>Categorías</span><strong aria-hidden="true">{open ? "✕" : "▾"}</strong>
    </button>
    {open ? <div className={`menu-panel${current ? " has-sub" : ""}`} id="category-menu-panel">
      <div className="menu-roots" onKeyDown={onListKey} onMouseLeave={() => window.clearTimeout(timer.current)}>
        {menu.map((item) => item.children.length === 0
          ? <Link key={item.id} href={item.href} className="menu-root" onClick={() => close()}>{item.name}</Link>
          : <button key={item.id} type="button" className={`menu-root${active === item.id ? " active" : ""}`} aria-expanded={active === item.id} onMouseEnter={() => hover(item.id)} onClick={() => setActive(item.id)}>
              <span>{item.name}</span><em aria-hidden="true">›</em>
            </button>)}
      </div>
      {current ? <div className="menu-sub">
        <button type="button" className="menu-back" onClick={() => setActive(null)}>← Volver</button>
        <div className="menu-sub-head">
          <h3>{current.name}</h3>
          <Link href={current.href} className="menu-all" onClick={() => close()}>Ver todo</Link>
        </div>
        <div className="menu-cols">
          {current.children.map((child) => <div className="menu-col" key={child.id}>
            <Link href={child.href} className="menu-col-title" onClick={() => close()}>{child.name}</Link>
            {child.children.map((leaf) => <Link key={leaf.id} href={leaf.href} onClick={() => close()}>{leaf.name}</Link>)}
            {child.children.length > 0 ? <Link href={child.href} className="menu-col-all" onClick={() => close()}>Ver todo</Link> : null}
          </div>)}
        </div>
      </div> : null}
    </div> : null}
  </div>;
}
```

- [ ] **Step 3: Estilos (sin cambiar la paleta)**

Agregar al final de `src/app/interaction.css`:

```css
/* Menú Categorías por niveles */
.category-menu{position:relative;flex:0 0 auto}
.category-menu .dropdown-trigger.active{border-bottom-color:var(--brand)}
.menu-panel{position:absolute;top:100%;left:0;z-index:40;display:grid;grid-template-columns:280px 1fr;width:min(1100px,calc(100vw - 32px));min-height:380px;max-height:70vh;background:#fff;border:1px solid var(--line);border-radius:0 0 12px 12px;box-shadow:0 24px 48px rgba(31,35,40,.2);overflow:hidden}
.menu-roots{display:flex;flex-direction:column;overflow-y:auto;background:#fff;border-right:1px solid var(--line)}
.menu-root{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;padding:12px 16px;border:0;border-radius:0;background:#fff;color:var(--text);font-family:inherit;font-size:14px;font-weight:600;text-align:left;text-decoration:none;cursor:pointer}
.menu-root:hover,.menu-root:focus-visible{background:#fff3f4}
.menu-root.active{background:var(--brand);color:#fff}
.menu-root em{font-style:normal;opacity:.7}
.menu-sub{padding:20px 28px;overflow-y:auto}
.menu-sub-head{display:flex;align-items:baseline;gap:14px;border-bottom:1px solid var(--line);padding-bottom:10px;margin-bottom:16px}
.menu-sub-head h3{margin:0;font-size:24px;letter-spacing:-.5px}
.menu-all{font-size:13px;font-weight:700;color:var(--brand);text-decoration:none}.menu-all:hover{text-decoration:underline}
.menu-cols{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:18px 24px}
.menu-col{display:grid;align-content:start;gap:7px}
.menu-col a{font-size:14px;color:var(--text);text-decoration:none}.menu-col a:hover{color:var(--brand);text-decoration:underline}
.menu-col .menu-col-title{font-weight:800}
.menu-col .menu-col-all{color:var(--muted);font-size:13px}
.menu-back{display:none}
@media(max-width:860px){
  .menu-panel{position:fixed;left:0;right:0;top:var(--menu-top,128px);bottom:0;width:auto;max-height:none;border-radius:0;grid-template-columns:1fr}
  .menu-panel.has-sub .menu-roots{display:none}
  .menu-back{display:inline-flex;margin-bottom:10px;background:none;color:var(--brand);font-weight:800;padding:4px 0;border:0}
  .menu-sub{padding:14px 16px}
  .menu-sub-head h3{font-size:20px}
}
```

- [ ] **Step 4: Conectarlo a la home**

En `src/app/page.tsx`: agregar `import { getMenuTree } from "@/lib/menu-tree";`, calcular el menú y su respaldo (mientras haya artículos sin convertir, el menú muestra las categorías planas de siempre):

```tsx
  const tree = await getMenuTree();
  const menu = tree.length > 0 ? tree : categoryTiles.map((tile) => ({ id: tile.name, name: tile.name, href: `/catalogo?category=${encodeURIComponent(tile.name)}`, count: tile.total, children: [] }));
```

y pasar `menu={menu}` a `<HomePage ... />`.

En `src/components/home-page.tsx`:
1. Agregar `import { CategoryMenu } from "./category-menu";` y `import type { MenuNode } from "@/lib/category-tree";`, y la prop `menu: MenuNode[]`.
2. Reemplazar el bloque `<div className="dropdown"> ... </div>` completo (el botón "Categorías" y su `dropdown-panel`, que va desde `<div className="dropdown">` hasta su `</div>` de cierre justo antes del botón "Más vendidos") por `<CategoryMenu menu={menu} />`.
3. Borrar lo que quedó sin uso: la función `goToCatalog`, el estado `openMenu`/`setOpenMenu`, `categoriesMenu` y `menuCategories`, y la línea `const router = useRouter();` junto con su import si ya no se usa.

- [ ] **Step 5: Verificar en el navegador (escritorio y celular)**

`npx tsc --noEmit && npx vitest run` — Expected: sin errores.

Escritorio (1440 px), en la home:
- Botón "Categorías" → se abre el panel con las categorías a la izquierda y la primera con subcategorías ya abierta a la derecha.
- Pasar el mouse sobre otra categoría principal → cambia la pestaña de la derecha **sin navegar** (la dirección no cambia).
- La pestaña muestra nombre + "Ver todo", columnas con títulos en negrita, enlaces de tercer nivel y "Ver todo" al final de cada columna.
- Clic en "Ver todo" → lleva a `/catalogo/<categoría>`; clic en una subcategoría → a su página; el panel se cierra.
- Esc cierra el panel y devuelve el foco al botón; ↑ ↓ mueven entre las categorías de la izquierda; clic afuera cierra.
- La categoría activa se ve en el rojo de marca (nada de azul).

Celular (390 px): con el panel abierto, Tab y Shift+Tab dan la vuelta dentro del panel sin salir de él; "Categorías" abre una hoja a pantalla completa con la lista; tocar una categoría muestra sus subcategorías con "← Volver" arriba y "Ver todo" junto al nombre; "Volver" regresa a la lista.

Consola sin errores ni avisos de hidratación en `/`, `/catalogo` y `/catalogo/<camino>`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/menu-tree.ts src/components/category-menu.tsx src/app/page.tsx src/components/home-page.tsx src/app/interaction.css
git commit -m "Menú Categorías por niveles: pestaña de subcategorías con Ver todo, sin navegar al pasar el mouse

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 15: Verificación final y entrega

**Files:**
- Ninguno nuevo (verificación y, si hace falta, ajustes).

- [ ] **Step 1: Pruebas, tipos y detector de diseño**

```bash
cd "/home/mati/Escritorio/Proyectos electronorte/catalogo-electronorte"
docker start mongo-catalogo
npx vitest run 2>&1 | tail -6
npx tsc --noEmit
/home/mati/.claude/skills/impeccable/scripts/impeccable detect --json src/components src/app | head -c 300
```
Expected: todas las pruebas pasan (con Mongo encendido ninguna queda omitida), sin errores de tipos y `[]` del detector.

- [ ] **Step 2: Compilar producción y medir**

```bash
PID=$(ss -ltnp | grep ':3000' | grep -o 'pid=[0-9]*' | head -1 | cut -d= -f2); [ -n "$PID" ] && kill $PID
npm run build 2>&1 | tail -30
(npm run start > /tmp/claude-1000/start.log 2>&1 &)
```
Expected: la compilación termina sin errores y lista `/catalogo/[[...path]]` como ruta dinámica. Con el servidor de producción local, medir la portada, `/catalogo` y `/catalogo/climatizacion` con el script de métricas de rendimiento (`/tmp/claude-1000/perf/metrics.js`, si no existe, medir FCP/LCP/CLS con `performance.getEntriesByType`): **CLS debe seguir en 0** en el catálogo y la portada no debe pedir datos de categorías a la API al cargar. Después, apagar ese servidor y reiniciar el de desarrollo (`npm run dev`).

- [ ] **Step 3: Recorrido completo en el navegador**

1. Admin → Categorías: crear, renombrar, mover, "Mover artículos", borrar (bloqueado con artículos o subcategorías, con el motivo a la vista).
2. Admin → Productos: editar un artículo con los selectores en cascada y guardar; el camino se ve en la lista.
3. Admin → Importar: subir un Excel con caminos; la vista previa lista las categorías nuevas; importar; verificar el árbol.
4. Admin → Exportar: el CSV trae el camino en la columna Categoría; volver a subirlo da 0 categorías nuevas.
5. Tienda: menú, `/catalogo/<camino>`, subcategorías a la izquierda, migas, ficha del artículo con camino, enlace viejo `/catalogo?category=…` que redirige (308), `/catalogo/no-existe` que da 404.
6. Limpiar en el admin las categorías de primer nivel que quedaron **vacías** tras importar los caminos nuevos (las 28 planas que ya no tienen artículos): se borran desde Categorías (el botón Borrar solo funciona con las vacías).

- [ ] **Step 4: Entrega al usuario**

Informar: qué se hizo por etapa, el resultado de las pruebas y mediciones, y los **pasos para producción** (los hace el usuario):
1. `git push origin main` y esperar que Vercel marque Ready.
2. En el admin del sitio publicado → Categorías: apretar **"Convertir las categorías actuales"** (idempotente) y comprobar que ya no aparece el aviso.
3. Importar el Excel `datos-contabilium/importar-catalogo.xlsx` (vista previa primero: revisar la lista de categorías nuevas) para pasar los artículos al árbol propuesto.
4. Borrar desde Categorías las categorías de primer nivel antiguas que queden vacías.
5. Ajustar el árbol a gusto desde el admin.

- [ ] **Step 5: Commit final (si hubo ajustes)**

```bash
git status --short
git add -A && git commit -m "Categorías en varios niveles: ajustes finales de verificación

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```
