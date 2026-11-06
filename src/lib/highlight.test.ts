import { describe, expect, it } from "vitest";
import { highlightParts } from "./highlight";

describe("highlightParts", () => {
  it("marca la palabra buscada sin distinguir mayúsculas", () => {
    expect(highlightParts("Aire Split Carrier", "split")).toEqual([
      { text: "Aire ", match: false }, { text: "Split", match: true }, { text: " Carrier", match: false }
    ]);
  });
  it("ignora tildes en ambos lados", () => {
    expect(highlightParts("Frigorías 2250", "frigorias").find((part) => part.match)?.text).toBe("Frigorías");
    expect(highlightParts("Frigorias", "frigoría")).toEqual([{ text: "Frigoria", match: true }, { text: "s", match: false }]);
  });
  it("marca varias palabras y todas las apariciones", () => {
    const marked = highlightParts("Aire aire split", "aire split").filter((part) => part.match).map((part) => part.text);
    expect(marked.join("")).toBe("Aireairesplit");
  });
  it("sin búsqueda devuelve el texto tal cual", () => {
    expect(highlightParts("Hola", "  ")).toEqual([{ text: "Hola", match: false }]);
  });
});
