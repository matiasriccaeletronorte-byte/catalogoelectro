import { describe, expect, it } from "vitest";
import { detectImageType, extensionFor, isObjectId, isSafeUploadName } from "./uploads";

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

describe("detectImageType", () => {
  it("reconoce JPG, PNG y WebP por sus primeros bytes", () => {
    expect(detectImageType(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]))).toBe("image/jpeg");
    expect(detectImageType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    expect(detectImageType(Buffer.concat([Buffer.from("RIFF"), Buffer.from([0, 0, 0, 0]), Buffer.from("WEBP")]))).toBe("image/webp");
  });
  it("rechaza HTML y texto aunque diga ser imagen", () => {
    expect(detectImageType(Buffer.from("<html><script>alert(1)</script>"))).toBeNull();
    expect(detectImageType(Buffer.alloc(0))).toBeNull();
  });
});

describe("isObjectId", () => {
  it("solo 24 hex", () => {
    expect(isObjectId("65f0c2a1b2c3d4e5f6a7b8c9")).toBe(true);
    expect(isObjectId("123")).toBe(false);
    expect(isObjectId("../x")).toBe(false);
  });
});
