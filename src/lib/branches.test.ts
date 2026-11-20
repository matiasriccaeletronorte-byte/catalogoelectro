import { describe, expect, it } from "vitest";
import { branchesOrDefault, DEFAULT_BRANCHES, mergeBranchNumbers } from "./branches";

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

describe("mergeBranchNumbers (las direcciones no se modifican: solo cambian los números)", () => {
  const current = DEFAULT_BRANCHES;
  const [first, second] = current;

  it("actualiza el teléfono y el WhatsApp de cada sucursal", () => {
    const result = mergeBranchNumbers(current, [{ name: first.name, phone: " 011 1111-2222 ", whatsapp: "5491111112222" }, { name: second.name, phone: second.phone, whatsapp: second.whatsapp }]);
    expect(result[0]).toEqual({ ...first, phone: "011 1111-2222", whatsapp: "5491111112222" });
    expect(result[1]).toEqual(second);
  });
  it("ignora cualquier intento de cambiar el nombre, la localidad o la dirección del mapa", () => {
    const result = mergeBranchNumbers(current, [{ name: first.name, phone: "1", whatsapp: "2", city: "Otra ciudad", query: "Otra calle 1" } as never]);
    expect(result[0]).toMatchObject({ name: first.name, city: first.city, query: first.query, phone: "1", whatsapp: "2" });
  });
  it("no deja agregar sucursales ni quitar las que existen", () => {
    expect(mergeBranchNumbers(current, [{ name: "Una nueva", phone: "1", whatsapp: "2" }])).toEqual(current);
    expect(mergeBranchNumbers(current, [])).toEqual(current);
    expect(mergeBranchNumbers(current, [{ name: first.name, phone: "1", whatsapp: "2" }])).toHaveLength(2);
  });
  it("si no llega un número, conserva el que ya estaba", () => {
    const result = mergeBranchNumbers(current, [{ name: first.name }]);
    expect(result[0]).toEqual(first);
  });
});
