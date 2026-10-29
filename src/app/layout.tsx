import type { Metadata } from "next";
import "./globals.css";
import "./interaction.css";
import "./admin.css";
import { Header } from "@/components/header";

export const metadata: Metadata = {
  title: "Electronorte Outlet",
  description: "Electrodomésticos y tecnología con una experiencia de compra más moderna, clara y confiable."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>
                  <Header />
          {children}
          <a
            className="whatsapp-fab"
            href="https://wa.me/541154560043"
            target="_blank"
            rel="noreferrer"
            aria-label="Escribinos por WhatsApp"
          >
            <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
              <path
                fill="currentColor"
                d="M19.11 17.87c-.27-.14-1.59-.79-1.84-.89-.25-.09-.43-.14-.61.14-.18.27-.7.89-.86 1.07-.16.18-.32.2-.59.07-.27-.14-1.13-.42-2.16-1.34-.8-.72-1.34-1.61-1.5-1.88-.16-.27-.02-.42.12-.56.13-.13.27-.34.4-.51.13-.17.18-.29.27-.48.09-.18.04-.34-.02-.48-.07-.14-.61-1.47-.84-2.01-.22-.53-.45-.46-.61-.46h-.52c-.18 0-.48.07-.73.34-.25.27-.96.94-.96 2.28s.99 2.64 1.12 2.82c.14.18 1.91 2.92 4.64 4.09.65.28 1.15.45 1.55.58.65.2 1.24.17 1.7.1.52-.08 1.59-.65 1.82-1.28.23-.62.23-1.16.16-1.28-.06-.12-.24-.2-.51-.34zM16 4c-6.63 0-12 5.37-12 12 0 2.12.55 4.12 1.53 5.85L4 28l6.35-1.49A11.92 11.92 0 0 0 16 28c6.63 0 12-5.37 12-12S22.63 4 16 4zm0 21.8c-1.97 0-3.89-.53-5.56-1.54l-.4-.24-3.77.88.9-3.67-.26-.39A9.8 9.8 0 0 1 6.2 16c0-5.41 4.39-9.8 9.8-9.8s9.8 4.39 9.8 9.8-4.39 9.8-9.8 9.8z"
              />
            </svg>
          </a>
          <footer>Electronorte · Consultanos por WhatsApp</footer>
              </body>
    </html>
  );
}
