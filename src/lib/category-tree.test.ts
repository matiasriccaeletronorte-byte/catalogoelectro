import { describe, expect, it } from "vitest";
import {
  buildMenuTree, buildTree, canMove, categoryHref, childrenWithCounts, findUniqueByName, findUniqueBySlug, hasCycle, legacyCategoryHref, CategoryNodeData, derivedFields, descendantIds, findByName, formatPath,
  compareNodes, moveBefore, orderByRoots, missingPaths, nodePath, normalizeName, parsePathText, productPathText, resolveSlugs, slugify, uniqueSlug, validCategoryName
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

describe("revisión final: nombres y ciclos", () => {
  it("un nombre no puede llevar el signo > (rompería los caminos del Excel)", () => {
    expect(validCategoryName("TV > Audio")).toBe(false);
    expect(validCategoryName("TV, audio y tecnología")).toBe(true);
  });
  it("descendantIds termina aunque los datos tengan un ciclo", () => {
    const cyclic = [n("a", "A", "b"), n("b", "B", "a")];
    expect(descendantIds(cyclic, "a")).toEqual(["b"]);
  });
  it("hasCycle detecta un nodo que es su propio ancestro", () => {
    expect(hasCycle([n("a", "A", "b"), n("b", "B", "a")], "a")).toBe(true);
    expect(hasCycle(sample, "3")).toBe(false);
    expect(hasCycle(sample, "1")).toBe(false);
  });
});

describe("enlaces viejos hacia categorías que pasaron a un nivel más profundo", () => {
  it("legacyCategoryHref encuentra la categoría en cualquier nivel si el nombre es único", () => {
    expect(legacyCategoryHref(sample, "Split")).toBe("/catalogo/climatizacion/aires-acondicionados/split");
    expect(legacyCategoryHref(sample, "  aires ACONDICIONADOS ")).toBe("/catalogo/climatizacion/aires-acondicionados");
  });
  it("si el nombre se repite en distintas ramas no adivina", () => {
    const repeated = [...sample, n("9", "Bazar", "1")];
    expect(legacyCategoryHref(repeated, "Bazar")).toBeNull();
    expect(findUniqueByName(repeated, "Bazar")).toBeNull();
  });
  it("una dirección vieja de un solo segmento se resuelve si la dirección es única", () => {
    expect(findUniqueBySlug(sample, "split")?.id).toBe("3");
    expect(findUniqueBySlug(sample, "no-existe")).toBeNull();
    expect(findUniqueBySlug([...sample, n("9", "Split", "1")], "split")).toBeNull();
  });
});

describe("orden manual de las categorías", () => {
  const o = (id: string, name: string, order?: number, parentId: string | null = null): CategoryNodeData => ({ ...n(id, name, parentId), ...(order === undefined ? {} : { order }) });
  const names = (nodes: { name: string }[]) => nodes.map((x) => x.name);

  it("sin orden manual sigue siendo A–Z con Otros al final", () => {
    expect(names(buildTree([o("1", "Zeta"), o("2", "Otros"), o("3", "Alfa")]))).toEqual(["Alfa", "Zeta", "Otros"]);
  });
  it("con orden manual se respeta, aunque el nombre diga otra cosa", () => {
    expect(names(buildTree([o("1", "Alfa", 2), o("2", "Zeta", 0), o("3", "Otros", 1)]))).toEqual(["Zeta", "Otros", "Alfa"]);
  });
  it("las categorías sin orden (nuevas) van después de las ordenadas, entre sí A–Z", () => {
    expect(names(buildTree([o("1", "Nueva B"), o("2", "Primera", 0), o("3", "Nueva A"), o("4", "Segunda", 1)]))).toEqual(["Primera", "Segunda", "Nueva A", "Nueva B"]);
  });
  it("el orden de cada grupo es independiente", () => {
    const tree = buildTree([o("1", "Hogar", 1), o("2", "Bazar", 0, "1"), o("3", "Cocina", 1, "1"), o("4", "Clima", 0)]);
    expect(names(tree)).toEqual(["Clima", "Hogar"]);
    expect(names(tree[1].children)).toEqual(["Bazar", "Cocina"]);
  });
  it("compareNodes, el menú y los conteos usan el mismo orden", () => {
    const nodes = [o("1", "Alfa", 1), o("2", "Zeta", 0)];
    expect([...nodes].sort(compareNodes).map((x) => x.name)).toEqual(["Zeta", "Alfa"]);
    expect(names(childrenWithCounts(nodes, null, { "1": 1, "2": 1 }))).toEqual(["Zeta", "Alfa"]);
    expect(buildMenuTree(nodes, { "1": 1, "2": 1 }).map((x) => x.name)).toEqual(["Zeta", "Alfa"]);
  });

  describe("moveBefore", () => {
    const nodes = [o("1", "A", 0), o("2", "B", 1), o("3", "C", 2), o("4", "D", 3), o("9", "Hijo", undefined, "1")];
    it("pone el nodo antes de otro hermano", () => {
      expect(moveBefore(nodes, "4", "2")).toEqual(["1", "4", "2", "3"]);
      expect(moveBefore(nodes, "1", "3")).toEqual(["2", "1", "3", "4"]);
    });
    it("sin destino lo manda al final", () => {
      expect(moveBefore(nodes, "1", null)).toEqual(["2", "3", "4", "1"]);
    });
    it("soltarlo donde ya estaba no cambia nada", () => {
      expect(moveBefore(nodes, "2", "3")).toEqual(["1", "2", "3", "4"]);
      expect(moveBefore(nodes, "2", "2")).toEqual(["1", "2", "3", "4"]);
    });
    it("rechaza nodos que no existen o que no son hermanos", () => {
      expect(moveBefore(nodes, "x", "2")).toBeNull();
      expect(moveBefore(nodes, "4", "9")).toBeNull();
    });
  });
});

describe("orderByRoots (franja de categorías de la portada)", () => {
  const root = (id: string, name: string, order?: number): CategoryNodeData => ({ ...n(id, name), ...(order === undefined ? {} : { order }) });
  const tiles = [{ name: "Hogar", total: 50 }, { name: "Línea blanca", total: 400 }, { name: "Climatización", total: 300 }, { name: "Suelta", total: 5 }];
  it("sigue el orden de los grupos principales del árbol", () => {
    const nodes = [root("1", "Línea blanca", 2), root("2", "Hogar", 0), root("3", "Climatización", 1)];
    expect(orderByRoots(tiles, nodes).map((t) => t.name)).toEqual(["Hogar", "Climatización", "Línea blanca", "Suelta"]);
  });
  it("sin orden manual queda de la A a la Z, y lo que no está en el árbol va al final por cantidad", () => {
    const nodes = [root("1", "Línea blanca"), root("2", "Hogar"), root("3", "Climatización")];
    expect(orderByRoots(tiles, nodes).map((t) => t.name)).toEqual(["Climatización", "Hogar", "Línea blanca", "Suelta"]);
  });
  it("sin árbol deja el orden que traía", () => {
    expect(orderByRoots(tiles, []).map((t) => t.name)).toEqual(tiles.map((t) => t.name));
  });
});
