import type { Branch } from "./branches";

export const MALVINAS = "Malvinas Argentinas";

const has = (text: string) => /malvinas/i.test(text);

/** "Los Polvorines, Malvinas Argentinas, Buenos Aires": se aclara el partido porque las calles se confunden con las de CABA. */
export function branchLocation(branch: Pick<Branch, "city">): string {
  const city = (branch.city ?? "").trim();
  if (has(city)) return city;
  const parts = city.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) return `${MALVINAS}, Buenos Aires`;
  if (parts.length === 1) return `${parts[0]}, ${MALVINAS}, Buenos Aires`;
  return [parts[0], MALVINAS, ...parts.slice(1)].join(", ");
}

/** Búsqueda para Google Maps con el partido incluido, para que no marque la calle homónima de CABA. */
export function branchMapQuery(branch: Branch): string {
  const base = (branch.query ?? "").trim();
  if (base) return has(base) ? base : `${base} ${MALVINAS}`;
  return `${branch.name} ${branchLocation(branch)}`.trim();
}

export const phoneDigits = (branch: Pick<Branch, "whatsapp">): string => (branch.whatsapp ?? "").replace(/\D/g, "");

export function contactableBranches(branches: Branch[]): Branch[] {
  return branches.filter((branch) => phoneDigits(branch).length > 0);
}

/** Sucursal a usar: la elegida (si sigue existiendo y tiene WhatsApp) o la única disponible. `null` significa que hay que preguntar. */
export function chooseBranch(branches: Branch[], storedName: string | null): Branch | null {
  const available = contactableBranches(branches);
  if (available.length === 1) return available[0];
  if (!storedName) return null;
  return available.find((branch) => branch.name === storedName) ?? null;
}

export function parseStoredBranch(raw: string | null): string | null {
  if (!raw || raw.length > 200) return null;
  return raw;
}

/** WhatsApp argentino (549 + área + número) escrito como se marca desde el país: 5491121743430 → 011 2174-3430. Si no lo reconoce, lo devuelve igual. */
export function formatWhatsapp(value: string): string {
  const digits = value.replace(/\D/g, "");
  const match = /^549(11)(\d{4})(\d{4})$/.exec(digits);
  return match ? `0${match[1]} ${match[2]}-${match[3]}` : value.trim();
}
