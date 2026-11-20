import { describe, expect, it } from "vitest";
import { DEFAULT_BRANCHES, type Branch } from "./branches";
import { branchLocation, branchMapQuery, chooseBranch, contactableBranches, parseStoredBranch, phoneDigits } from "./branch-contact";

const a: Branch = { name: "Rivadavia 1743", city: "Los Polvorines, Buenos Aires", phone: "011 2174-3430", whatsapp: "5491121743430", query: "Rivadavia 1743 Los Polvorines Buenos Aires" };
const b: Branch = { name: "Av. Sesquicentenario 1106", city: "Los Polvorines, Buenos Aires", phone: "011 5456-0043", whatsapp: "+54 9 11 5456-0043", query: "" };

describe("branchLocation", () => {
  it("agrega Malvinas Argentinas entre la localidad y la provincia", () => {
    expect(branchLocation(a)).toBe("Los Polvorines, Malvinas Argentinas, Buenos Aires");
  });
  it("no lo repite si ya está", () => {
    expect(branchLocation({ city: "Los Polvorines, Malvinas Argentinas, Buenos Aires" })).toBe("Los Polvorines, Malvinas Argentinas, Buenos Aires");
    expect(branchLocation({ city: "los polvorines - MALVINAS ARGENTINAS" })).toBe("los polvorines - MALVINAS ARGENTINAS");
  });
  it("con una sola palabra o vacío", () => {
    expect(branchLocation({ city: "Los Polvorines" })).toBe("Los Polvorines, Malvinas Argentinas, Buenos Aires");
    expect(branchLocation({ city: "" })).toBe("Malvinas Argentinas, Buenos Aires");
  });
});

describe("branchMapQuery", () => {
  it("agrega Malvinas Argentinas a la búsqueda del mapa", () => {
    expect(branchMapQuery(a)).toBe("Rivadavia 1743 Los Polvorines Buenos Aires Malvinas Argentinas");
  });
  it("sin dirección para el mapa usa nombre y localidad", () => {
    expect(branchMapQuery(b)).toBe("Av. Sesquicentenario 1106 Los Polvorines, Malvinas Argentinas, Buenos Aires");
  });
  it("no lo repite", () => {
    expect(branchMapQuery({ ...a, query: "Rivadavia 1743 Malvinas Argentinas" })).toBe("Rivadavia 1743 Malvinas Argentinas");
  });
});

describe("contactableBranches / phoneDigits", () => {
  it("deja solo las sucursales con WhatsApp", () => {
    expect(contactableBranches([a, { ...b, whatsapp: " " }, { ...b, whatsapp: "abc" }])).toEqual([a]);
  });
  it("limpia el número", () => {
    expect(phoneDigits(b)).toBe("5491154560043");
  });
  it("las sucursales de fábrica tienen WhatsApp", () => {
    expect(contactableBranches(DEFAULT_BRANCHES)).toHaveLength(2);
  });
});

describe("chooseBranch", () => {
  it("usa la guardada si existe", () => {
    expect(chooseBranch([a, b], b.name)).toBe(b);
  });
  it("ignora una guardada que ya no existe", () => {
    expect(chooseBranch([a, b], "Otra")).toBeNull();
  });
  it("si una sucursal quedó sin WhatsApp, la otra es la única y se usa sin preguntar", () => {
    expect(chooseBranch([a, { ...b, whatsapp: "" }], b.name)).toBe(a);
  });
  it("si hay una sola, es esa sin preguntar", () => {
    expect(chooseBranch([a], null)).toBe(a);
  });
  it("con varias y sin elección devuelve null (hay que preguntar)", () => {
    expect(chooseBranch([a, b], null)).toBeNull();
  });
  it("sin sucursales devuelve null", () => {
    expect(chooseBranch([], "x")).toBeNull();
  });
});

describe("parseStoredBranch", () => {
  it("acepta texto razonable y rechaza el resto", () => {
    expect(parseStoredBranch("Rivadavia 1743")).toBe("Rivadavia 1743");
    expect(parseStoredBranch(null)).toBeNull();
    expect(parseStoredBranch("")).toBeNull();
    expect(parseStoredBranch("x".repeat(300))).toBeNull();
  });
});
