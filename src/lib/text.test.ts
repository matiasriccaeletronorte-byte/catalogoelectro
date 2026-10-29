import { describe, expect, it } from "vitest";
import { normalizeText } from "./text";

describe("normalizeText", () => {
  it("pasa a minúsculas y quita tildes", () => {
    expect(normalizeText("  CAFÉ   Ñandú ")).toBe("cafe nandu");
  });
  it("cadena vacía", () => {
    expect(normalizeText("")).toBe("");
  });
});
