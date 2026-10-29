import { describe, expect, it } from "vitest";
import { buildMatch, parseFilters, serializeFilters } from "./catalog-filters";

const parse = (qs: string) => parseFilters(new URLSearchParams(qs));

describe("parseFilters", () => {
  it("valores por defecto", () => {
    expect(parse("")).toEqual({ q: "", category: "", subCategory: "", brands: [], minPrice: undefined, maxPrice: undefined, availableOnly: false, sort: "relevance", page: 1 });
  });
  it("normaliza valores inválidos", () => {
    const f = parse("page=-3&minPrice=abc&maxPrice=-5&sort=xyz");
    expect(f.page).toBe(1);
    expect(f.minPrice).toBeUndefined();
    expect(f.maxPrice).toBeUndefined();
    expect(f.sort).toBe("relevance");
  });
  it("lee marcas múltiples y rango", () => {
    const f = parse("brand=Samsung&brand=LG&minPrice=1000&maxPrice=5000&available=1&sort=price_asc&page=3");
    expect(f.brands).toEqual(["Samsung", "LG"]);
    expect([f.minPrice, f.maxPrice, f.availableOnly, f.sort, f.page]).toEqual([1000, 5000, true, "price_asc", 3]);
  });
});

describe("serializeFilters", () => {
  it("ida y vuelta", () => {
    const qs = "q=heladera&category=Heladeras&brand=LG&brand=Samsung&minPrice=100&sort=price_desc&page=2";
    expect(serializeFilters(parse(qs)).toString()).toBe(new URLSearchParams(qs).toString());
  });
  it("omite los valores por defecto", () => {
    expect(serializeFilters(parse("")).toString()).toBe("");
  });
});

describe("buildMatch", () => {
  it("siempre filtra activos", () => {
    expect(buildMatch(parse(""))).toEqual({ active: { $ne: false } });
  });
  it("categoría, marcas y precio", () => {
    const m = buildMatch(parse("category=Heladeras&brand=LG&brand=Samsung&minPrice=10&maxPrice=20&available=1"));
    expect(m).toEqual({ active: { $ne: false }, available: true, category: "Heladeras", brand: { $in: ["LG", "Samsung"] }, listPrice: { $gte: 10, $lte: 20 } });
  });
  it("omit quita la propia faceta", () => {
    const m = buildMatch(parse("category=Heladeras&brand=LG&minPrice=10"), "brand");
    expect(m).toEqual({ active: { $ne: false }, category: "Heladeras", listPrice: { $gte: 10 } });
  });
  it("búsqueda: una regex por palabra, sin tildes, escapando caracteres especiales", () => {
    const m = buildMatch(parse(`q=${encodeURIComponent("Café (2+")}`));
    expect(m.$and).toEqual([{ searchText: { $regex: "cafe" } }, { searchText: { $regex: "\\(2\\+" } }]);
  });
});
