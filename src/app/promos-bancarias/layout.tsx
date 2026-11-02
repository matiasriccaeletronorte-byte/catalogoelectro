import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Promos bancarias y cuotas sin interés",
  description: "Cuotas sin interés los miércoles y sábados, 6 cuotas con Hipotecario los miércoles y con BBVA en las fechas especiales de Electronorte.",
  alternates: { canonical: "/promos-bancarias" }
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
