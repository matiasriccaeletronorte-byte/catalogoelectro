import { formatWhatsapp } from "./branch-contact";

export type Branch = { name: string; city: string; phone: string; whatsapp: string; query: string };

export const DEFAULT_BRANCHES: Branch[] = [
  { name: "Rivadavia 1743", city: "Los Polvorines, Buenos Aires", phone: "011 2174-3430", whatsapp: "5491121743430", query: "Rivadavia 1743 Los Polvorines Buenos Aires" },
  { name: "Av. Sesquicentenario 1106", city: "Los Polvorines, Buenos Aires", phone: "011 5456-0043", whatsapp: "5491154560043", query: "Av. Sesquicentenario 1106 Los Polvorines Buenos Aires" }
];

/** Sin nada guardado se muestran las sucursales originales; una lista guardada vacía significa que se quitaron todas. */
export function branchesOrDefault(saved: Branch[] | undefined | null): Branch[] {
  return saved ? saved : DEFAULT_BRANCHES;
}

/** Las sucursales y sus direcciones son fijas: del formulario solo se toma el WhatsApp de cada una (se empareja por nombre). El teléfono que se muestra sale de ese mismo número. No se agregan, no se quitan y no se editan direcciones. */
export function mergeBranchNumbers(current: Branch[], submitted: { name: string; whatsapp?: string }[]): Branch[] {
  return current.map((branch) => {
    const sent = submitted.find((item) => item.name === branch.name);
    const whatsapp = (sent?.whatsapp ?? branch.whatsapp).trim();
    return sent ? { ...branch, whatsapp, phone: formatWhatsapp(whatsapp) } : branch;
  });
}
