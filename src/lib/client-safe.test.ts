import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Estos módulos los importan componentes del navegador: no pueden traer mongoose, modelos ni la conexión a la base.
const CLIENT_MODULES = ["catalog-filters", "category-tree", "cash-discount", "image-limits", "branch-contact", "highlight", "cart", "coupons"];

describe("módulos que llegan al navegador", () => {
  for (const name of CLIENT_MODULES) {
    it(`${name}.ts no importa mongoose, modelos ni la conexión a la base`, () => {
      const source = readFileSync(`src/lib/${name}.ts`, "utf8");
      expect(source).not.toMatch(/from\s+["']mongoose["']/);
      expect(source).not.toMatch(/from\s+["']@\/models\//);
      expect(source).not.toMatch(/from\s+["']@\/lib\/(db|category-store|catalog-query)["']/);
    });
  }
});
