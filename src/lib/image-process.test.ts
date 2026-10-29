import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { processImage } from "./image-process";

describe("processImage", () => {
  it("achica a 1200 px de ancho máximo y convierte a WebP", async () => {
    const big = await sharp({ create: { width: 3000, height: 2000, channels: 3, background: "#c33" } }).png().toBuffer();
    const out = await processImage(big);
    const meta = await sharp(out).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.width).toBe(1200);
    expect(meta.height).toBe(800);
    expect(out.length).toBeLessThan(big.length);
  });
  it("no agranda imágenes chicas", async () => {
    const small = await sharp({ create: { width: 400, height: 300, channels: 3, background: "#369" } }).jpeg().toBuffer();
    expect((await sharp(await processImage(small)).metadata()).width).toBe(400);
  });
  it("rechaza archivos que no son imagen", async () => {
    await expect(processImage(Buffer.from("<html>no</html>"))).rejects.toThrow();
  });
});
