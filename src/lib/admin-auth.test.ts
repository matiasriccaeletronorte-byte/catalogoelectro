import { describe, expect, it } from "vitest";
import { IDLE_LIMIT_MS, isSessionActive, shouldTouchSession } from "./admin-auth";

const now = new Date("2026-11-10T12:00:00Z");
const ago = (ms: number) => new Date(now.getTime() - ms);
const later = (ms: number) => new Date(now.getTime() + ms);

describe("sesión del admin", () => {
  it("sigue activa si hubo actividad reciente", () => {
    expect(isSessionActive({ expiresAt: later(3_600_000), lastSeenAt: ago(5 * 60_000) }, now)).toBe(true);
  });
  it("se cierra tras el tiempo sin actividad", () => {
    expect(isSessionActive({ expiresAt: later(3_600_000), lastSeenAt: ago(IDLE_LIMIT_MS + 1000) }, now)).toBe(false);
  });
  it("se cierra al llegar al máximo de 8 horas aunque haya actividad", () => {
    expect(isSessionActive({ expiresAt: ago(1000), lastSeenAt: ago(1000) }, now)).toBe(false);
  });
  it("una sesión vieja sin lastSeenAt usa la fecha de creación", () => {
    expect(isSessionActive({ expiresAt: later(3_600_000), createdAt: ago(IDLE_LIMIT_MS + 1000) }, now)).toBe(false);
    expect(isSessionActive({ expiresAt: later(3_600_000), createdAt: ago(60_000) }, now)).toBe(true);
  });
  it("no escribe en la base en cada pedido, solo cada minuto", () => {
    expect(shouldTouchSession({ expiresAt: later(1), lastSeenAt: ago(10_000) }, now)).toBe(false);
    expect(shouldTouchSession({ expiresAt: later(1), lastSeenAt: ago(61_000) }, now)).toBe(true);
  });
});
