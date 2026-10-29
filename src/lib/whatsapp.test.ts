import { describe, expect, it } from "vitest";
import { buildWhatsappUrl, DEFAULT_TEMPLATE } from "./whatsapp";

describe("buildWhatsappUrl", () => {
  it("arma el link con nombre, código y link, codificados", () => {
    const url = buildWhatsappUrl("+54 9 11 5456-0043", DEFAULT_TEMPLATE, { name: "Heladera 340L", sku: "HEL-340", link: "https://x.com/productos/1" });
    expect(url.startsWith("https://wa.me/5491154560043?text=")).toBe(true);
    const text = decodeURIComponent(url.split("?text=")[1]);
    expect(text).toBe("Hola, quiero consultar por Heladera 340L (código HEL-340) – https://x.com/productos/1");
  });
  it("sin SKU omite el paréntesis", () => {
    const text = decodeURIComponent(buildWhatsappUrl("5491100000000", DEFAULT_TEMPLATE, { name: "Lámpara", link: "https://x.com/p" }).split("?text=")[1]);
    expect(text).toBe("Hola, quiero consultar por Lámpara – https://x.com/p");
  });
  it("sin teléfono devuelve cadena vacía", () => {
    expect(buildWhatsappUrl("", DEFAULT_TEMPLATE, { name: "A", link: "b" })).toBe("");
  });
});
