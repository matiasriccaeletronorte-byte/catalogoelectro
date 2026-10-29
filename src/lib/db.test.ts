import mongoose from "mongoose";
import { afterAll, describe, expect, it } from "vitest";
import { connectDb } from "./db";

// Prueba de integración: necesita MongoDB local para el segundo intento. Si no hay, se omite.
const goodUri = process.env.MONGODB_TEST_URI || "mongodb://localhost:27017/catalogo_test";

afterAll(async () => { await mongoose.disconnect(); });

describe("connectDb", () => {
  it("tras un fallo de conexión, el siguiente intento vuelve a conectar", async (ctx) => {
    try {
      const probe = await mongoose.createConnection(goodUri, { serverSelectionTimeoutMS: 1500 }).asPromise();
      await probe.close();
    } catch {
      return ctx.skip();
    }
    process.env.MONGODB_TIMEOUT_MS = "500";
    process.env.MONGODB_URI = "mongodb://127.0.0.1:1/x";
    await expect(connectDb()).rejects.toThrow();
    process.env.MONGODB_URI = goodUri;
    await expect(connectDb()).resolves.toBeDefined();
    expect(mongoose.connection.readyState).toBe(1);
  });
});
