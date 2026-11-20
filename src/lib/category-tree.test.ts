import { describe, expect, it } from "vitest";
import {
  buildMenuTree, buildTree, canMove, categoryHref, CategoryNodeData, derivedFields, descendantIds, findByName, formatPath,
  missingPaths, nodePath, normalizeName, parsePathText, productPathText, resolveSlugs, slugify, uniqueSlug, validCategoryName
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
