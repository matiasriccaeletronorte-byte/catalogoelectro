import { describe, expect, it } from "vitest";
import { branchesOrDefault, DEFAULT_BRANCHES } from "./branches";

describe("branchesOrDefault", () => {
  it("sin sucursales guardadas usa las dos de siempre", () => {
    expect(branchesOrDefault(undefined)).toEqual(DEFAULT_BRANCHES);
    expect(DEFAULT_BRANCHES).toHaveLength(2);
  });
  it("una lista guardada vacía se respeta (el admin las quitó todas)", () => {
    expect(branchesOrDefault([])).toEqual([]);
  });
  it("devuelve las guardadas tal cual", () => {
    const saved = [{ name: "Centro 123", city: "Tigre", phone: "011 1", whatsapp: "5491100000000", query: "Centro 123 Tigre" }];
    expect(branchesOrDefault(saved)).toEqual(saved);
  });
});
