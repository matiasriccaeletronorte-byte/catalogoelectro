import { describe, expect, it } from "vitest";
import { extensionFor, isSafeUploadName } from "./uploads";

describe("isSafeUploadName", () => {
  it("acepta nombres generados", () => {
    expect(isSafeUploadName("65f0c2a1b2c3d4e5f6a7b8c9-1730000000000.jpg")).toBe(true);
  });
  it("rechaza recorridos de carpeta", () => {
    expect(isSafeUploadName("../.env.local")).toBe(false);
    expect(isSafeUploadName("..%2F.env")).toBe(false);
    expect(isSafeUploadName("a/b.jpg")).toBe(false);
  });
  it("rechaza extensiones no permitidas", () => {
    expect(isSafeUploadName("x-1.html")).toBe(false);
  });
});

describe("extensionFor", () => {
  it("solo imágenes comunes", () => {
    expect(extensionFor("image/jpeg")).toBe("jpg");
    expect(extensionFor("image/png")).toBe("png");
    expect(extensionFor("image/webp")).toBe("webp");
    expect(extensionFor("text/html")).toBeNull();
  });
});
