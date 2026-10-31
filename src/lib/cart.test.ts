import { describe, expect, it } from "vitest";
import { addLine, buildCartMessage, buildCartUrl, cartCount, cartTotals, MAX_CART_LINES, parseStoredCart, removeLine, setQty } from "./cart";
import type { Product } from "./types";

const p = (id: string, cash: number, list: number): Product => ({ id, sku: `S-${id}`, name: `Art ${id}`, description: "", cashPrice: cash, listPrice: list, available: true, category: "c", outlet: false, image: "" });

describe("cart", () => {
  it("suma cantidades del mismo artículo", () => {
    expect(addLine(addLine([], "a"), "a")).toEqual([{ id: "a", qty: 2 }]);
  });
  it("setQty 0 quita la línea", () => {
    expect(setQty([{ id: "a", qty: 2 }], "a", 0)).toEqual([]);
    expect(removeLine([{ id: "a", qty: 1 }, { id: "b", qty: 1 }], "a")).toEqual([{ id: "b", qty: 1 }]);
  });
  it("limita la cantidad de líneas", () => {
    let lines = [] as ReturnType<typeof addLine>;
    for (let i = 0; i < MAX_CART_LINES + 5; i++) lines = addLine(lines, String(i));
    expect(lines).toHaveLength(MAX_CART_LINES);
  });
  it("cuenta unidades", () => {
    expect(cartCount([{ id: "a", qty: 2 }, { id: "b", qty: 3 }])).toBe(5);
  });
  it("ignora datos guardados corruptos", () => {
    expect(parseStoredCart("basura")).toEqual([]);
    expect(parseStoredCart('[{"id":"a","qty":2},{"id":1,"qty":1},{"id":"b","qty":-1}]')).toEqual([{ id: "a", qty: 2 }]);
    expect(parseStoredCart(null)).toEqual([]);
  });
  it("calcula los dos totales e ignora artículos que ya no existen", () => {
    const products = new Map([["a", p("a", 100, 120)], ["b", p("b", 50, 60)]]);
    expect(cartTotals([{ id: "a", qty: 2 }, { id: "b", qty: 1 }, { id: "x", qty: 9 }], products)).toEqual({ cash: 250, list: 300 });
  });
  it("arma el mensaje con ambos totales", () => {
    const products = new Map([["a", p("a", 100, 120)]]);
    const msg = buildCartMessage([{ id: "a", qty: 2 }], products, "https://x.com");
    expect(msg).toContain("2 x Art a (código S-a)");
    expect(msg).toContain("https://x.com/productos/a");
    expect(msg).toContain("Total en efectivo: $200");
    expect(msg).toContain("Total de contado: $240");
  });
  it("sin teléfono no arma link", () => {
    expect(buildCartUrl("", "x")).toBe("");
    expect(buildCartUrl("+54 9 11 5456-0043", "a b")).toBe("https://wa.me/5491154560043?text=a%20b");
  });
});
