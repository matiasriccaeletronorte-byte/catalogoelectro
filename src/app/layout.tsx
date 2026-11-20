import type { Metadata } from "next";
import "./globals.css";
import "./interaction.css";
import "./admin.css";
import { Header } from "@/components/header";
import { CartProvider } from "@/components/cart-provider";
import { CartDrawer } from "@/components/cart-drawer";
import { SiteSettingsProvider } from "@/components/site-settings-provider";
import { BranchProvider } from "@/components/branch-provider";
import { WhatsappFab } from "@/components/whatsapp-fab";
import { siteUrl } from "@/lib/site-url";
import { getSiteSettings } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

const description = "Electrodomésticos, tecnología y hogar en Los Polvorines. Precio en efectivo, cuotas sin interés los miércoles y sábados, y consulta directa por WhatsApp.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: "Electronorte Outlet | Electrodomésticos y tecnología en Los Polvorines", template: "%s | Electronorte" },
  description,
  openGraph: { type: "website", locale: "es_AR", siteName: "Electronorte", title: "Electronorte Outlet", description, images: ["/electronorte-white-red.png"] },
  twitter: { card: "summary", title: "Electronorte Outlet", description }
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const settings = await getSiteSettings();
  return (
    <html lang="es">
      <body>
        <SiteSettingsProvider initial={settings} siteOrigin={siteUrl()}>
          <BranchProvider>
          <CartProvider>
          <Header />
          <CartDrawer />
          {children}
          <WhatsappFab />
          </CartProvider>
          </BranchProvider>
          <footer>Electronorte · Consultanos por WhatsApp</footer>
        </SiteSettingsProvider>
      </body>
    </html>
  );
}
