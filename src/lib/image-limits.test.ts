import { describe, expect, it } from "vitest";
import { planUploads } from "./image-limits";

const f = (name: string, type = "image/jpeg") => ({ name, type });

describe("planUploads", () => {
  it("acepta todas si caben", () => {
    expect(planUploads([f("a.jpg"), f("b.png", "image/png")], 0)).toEqual({ accepted: [f("a.jpg"), f("b.png", "image/png")], overLimit: 0, wrongType: [] });
  });
  it("corta en el máximo de 10 contando las que ya tiene", () => {
    const files = Array.from({ length: 6 }, (_, i) => f(`${i}.jpg`));
    const plan = planUploads(files, 7);
    expect(plan.accepted.map((x) => x.name)).toEqual(["0.jpg", "1.jpg", "2.jpg"]);
    expect(plan.overLimit).toBe(3);
  });
  it("separa lo que no es imagen permitida", () => {
    const plan = planUploads([f("a.jpg"), f("doc.pdf", "application/pdf"), f("g.gif", "image/gif")], 0);
    expect(plan.accepted).toHaveLength(1);
    expect(plan.wrongType).toEqual(["doc.pdf", "g.gif"]);
  });
  it("sin lugar no sube ninguna", () => {
    expect(planUploads([f("a.jpg")], 10)).toEqual({ accepted: [], overLimit: 1, wrongType: [] });
  });
});
