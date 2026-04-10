import type { Metadata } from "next";
import { publicEnv } from "@/lib/public-env";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

import "./globals.css";

export const metadata: Metadata = {
  title: `${publicEnv.siteName} | Discord Bot Platform`,
  description:
    "Платформа управления Lunaria Fox: лендинг, docs, pricing и Discord dashboard для настройки бота через Supabase-backed конфиги.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body>
        <div className="app-shell">
          <div className="ambient ambient-left" />
          <div className="ambient ambient-right" />
          <SiteHeader />
          <main>{children}</main>
          <SiteFooter />
          <a className="floating-support" href={publicEnv.supportUrl} rel="noreferrer" target="_blank">
            Support
          </a>
        </div>
      </body>
    </html>
  );
}
