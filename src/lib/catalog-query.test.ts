import { describe, expect, it } from "vitest";
import { Types } from "mongoose";
import { toPublicProduct } from "./catalog-query";

describe("toPublicProduct", () => {
  const base = { _id: new Types.ObjectId(), name: "Aire", sku: "A1", category: "Climatización", subCategory: "Aires", cashPrice: 1, listPrice: 2, available: true, outlet: false, image: "", searchText: "x", stock: 3, active: true, __v: 0 };

  it("convierte el id y quita campos internos", () => {
    const out = toPublicProduct(base) as Record<string, unknown>;
    expect(out.id).toBe(String(base._id));
    expect(out).not.toHaveProperty("searchText");
    expect(out).not.toHaveProperty("_id");
  });

  it("categoryId sale como texto y categoryPath no sale", () => {
    const categoryId = new Types.ObjectId();
    const out = toPublicProduct({ ...base, categoryId, categoryPath: [new Types.ObjectId(), categoryId] }) as Record<string, unknown>;
    expect(out.categoryId).toBe(String(categoryId));
    expect(out).not.toHaveProperty("categoryPath");
  });

  it("sin categoryId no inventa el campo", () => {
    const out = toPublicProduct({ ...base, categoryId: null, categoryPath: [] }) as Record<string, unknown>;
    expect(out).not.toHaveProperty("categoryId");
  });

  it("el resultado se puede serializar a JSON sin ObjectId", () => {
    const categoryId = new Types.ObjectId();
    const json = JSON.stringify(toPublicProduct({ ...base, categoryId, categoryPath: [categoryId] }));
    expect(json).toContain(String(categoryId));
    expect(json).not.toContain("buffer");
  });
});
