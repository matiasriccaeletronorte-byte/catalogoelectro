export type Promo = { id: "cuotas3" | "hipotecario6" | "bbva6"; installments: number; label: string };
export type NextPromo = { label: string; daysAhead: number };

const TZ = "America/Argentina/Buenos_Aires";
const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function argentinaYmd(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function argentinaWeekday(date: Date): number {
  return WEEKDAY_INDEX[new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short" }).format(date)];
}

export function activePromos(date: Date, bbvaDates: string[]): Promo[] {
  const weekday = argentinaWeekday(date);
  const promos: Promo[] = [];
  if (weekday === 3 || weekday === 6) promos.push({ id: "cuotas3", installments: 3, label: "3 cuotas sin interés" });
  if (weekday === 3) promos.push({ id: "hipotecario6", installments: 6, label: "6 cuotas con Hipotecario" });
  if (bbvaDates.includes(argentinaYmd(date))) promos.push({ id: "bbva6", installments: 6, label: "6 cuotas con BBVA" });
  return promos;
}

export function nextPromo(date: Date, bbvaDates: string[]): NextPromo | null {
  if (activePromos(date, bbvaDates).length > 0) return null;
  for (let daysAhead = 1; daysAhead <= 35; daysAhead++) {
    const candidate = new Date(date.getTime() + daysAhead * 86_400_000);
    if (activePromos(candidate, bbvaDates).length > 0) return { label: WEEKDAYS[argentinaWeekday(candidate)], daysAhead };
  }
  return null;
}

export function installmentValue(listPrice: number, installments: number): number {
  return Math.round(listPrice / installments);
}
