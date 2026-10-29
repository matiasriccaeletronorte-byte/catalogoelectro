export type Branch = { name: string; city: string; phone: string; whatsapp: string; query: string };

export const DEFAULT_BRANCHES: Branch[] = [
  { name: "Rivadavia 1743", city: "Los Polvorines, Buenos Aires", phone: "011 2174-3430", whatsapp: "5491121743430", query: "Rivadavia 1743 Los Polvorines Buenos Aires" },
  { name: "Av. Sesquicentenario 1106", city: "Los Polvorines, Buenos Aires", phone: "011 5456-0043", whatsapp: "5491154560043", query: "Av. Sesquicentenario 1106 Los Polvorines Buenos Aires" }
];

/** Sin nada guardado se muestran las sucursales originales; una lista guardada vacía significa que se quitaron todas. */
export function branchesOrDefault(saved: Branch[] | undefined | null): Branch[] {
  return saved ? saved : DEFAULT_BRANCHES;
}
