import { describe, expect, it } from "vitest";
import { slideImages } from "./slide-images";

describe("slideImages", () => {
  it("con las dos imágenes, cada pantalla usa la suya", () => {
    expect(slideImages({ image: "https://x/d.jpg", mobileImage: "https://x/m.jpg" })).toEqual({ desktop: "https://x/d.jpg", mobile: "https://x/m.jpg" });
  });
  it("sin imagen de celular, el celular usa la de escritorio (banners ya cargados)", () => {
    expect(slideImages({ image: "https://x/d.jpg" })).toEqual({ desktop: "https://x/d.jpg", mobile: "https://x/d.jpg" });
    expect(slideImages({ image: "https://x/d.jpg", mobileImage: "" })).toEqual({ desktop: "https://x/d.jpg", mobile: "https://x/d.jpg" });
  });
  it("sin imagen de escritorio, escritorio usa la de celular", () => {
    expect(slideImages({ image: "", mobileImage: "https://x/m.jpg" })).toEqual({ desktop: "https://x/m.jpg", mobile: "https://x/m.jpg" });
  });
  it("sin ninguna imagen no hay banner con foto", () => {
    expect(slideImages({ image: "" })).toEqual({ desktop: "", mobile: "" });
    expect(slideImages({})).toEqual({ desktop: "", mobile: "" });
  });
});
