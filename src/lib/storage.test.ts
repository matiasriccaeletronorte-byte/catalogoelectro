import { mkdtemp, readFile, rm } from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { localStorageDriver, supabaseStorageDriver } from "./storage";

type Call = { url: string; init: RequestInit };
const fakeFetch = (status = 200, calls: Call[] = []) =>
  (async (url: string | URL | Request, init?: RequestInit) => { calls.push({ url: String(url), init: init ?? {} }); return new Response("{}", { status }); }) as typeof fetch;

describe("supabaseStorageDriver", () => {
  const config = { url: "https://abc.supabase.co/", serviceKey: "SERVICE", bucket: "productos" };

  it("sube con la clave de servicio y devuelve la URL pública", async () => {
    const calls: Call[] = [];
    const driver = supabaseStorageDriver(config, fakeFetch(200, calls));
    const url = await driver.put("a1-1730000000000.webp", Buffer.from("x"), "image/webp");
    expect(url).toBe("https://abc.supabase.co/storage/v1/object/public/productos/a1-1730000000000.webp");
    expect(calls[0].url).toBe("https://abc.supabase.co/storage/v1/object/productos/a1-1730000000000.webp");
    expect(calls[0].init.method).toBe("POST");
    expect(calls[0].init.headers).toMatchObject({ Authorization: "Bearer SERVICE", "Content-Type": "image/webp" });
  });
  it("si Supabase responde error, falla con un mensaje claro", async () => {
    const driver = supabaseStorageDriver(config, fakeFetch(403));
    await expect(driver.put("a.webp", Buffer.from("x"), "image/webp")).rejects.toThrow(/Supabase/);
  });
  it("borra solo URLs de su propio bucket", async () => {
    const calls: Call[] = [];
    const driver = supabaseStorageDriver(config, fakeFetch(200, calls));
    await driver.remove("https://abc.supabase.co/storage/v1/object/public/productos/a1-1.webp");
    await driver.remove("https://otro.com/foto.png");
    await driver.remove("/api/uploads/a1-1.webp");
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://abc.supabase.co/storage/v1/object/productos/a1-1.webp");
    expect(calls[0].init.method).toBe("DELETE");
  });
});

describe("localStorageDriver", () => {
  let dir = "";
  afterEach(async () => { if (dir) await rm(dir, { recursive: true, force: true }); });

  it("guarda en la carpeta y devuelve la ruta /api/uploads", async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "up-"));
    const driver = localStorageDriver(dir);
    const url = await driver.put("65f0c2a1b2c3d4e5f6a7b8c9-1730000000000.webp", Buffer.from("hola"), "image/webp");
    expect(url).toBe("/api/uploads/65f0c2a1b2c3d4e5f6a7b8c9-1730000000000.webp");
    expect((await readFile(path.join(dir, "65f0c2a1b2c3d4e5f6a7b8c9-1730000000000.webp"))).toString()).toBe("hola");
    await driver.remove(url);
    await expect(readFile(path.join(dir, "65f0c2a1b2c3d4e5f6a7b8c9-1730000000000.webp"))).rejects.toThrow();
  });
  it("no borra archivos fuera de la carpeta", async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "up-"));
    await expect(localStorageDriver(dir).remove("/api/uploads/../../etc/passwd")).resolves.toBeUndefined();
  });
});
