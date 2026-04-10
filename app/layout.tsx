import type { Metadata } from "next";
import { env } from "@/lib/env";
import { getSession } from "@/lib/auth/session";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

import "./globals.css";

export const metadata: Metadata = {
  title: `${env.siteName} | Discord Bot Platform`,
  description:
    "Платформа управления Lunaria Fox: лендинг, docs, pricing и Discord dashboard для настройки бота через Supabase-backed конфиги.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSession();

  return (
    <html lang="ru">
      <body>
        <div className="app-shell">
          <div className="ambient ambient-left" />
          <div className="ambient ambient-right" />
          <SiteHeader session={session} />
          <main>{children}</main>
          <SiteFooter />
          <a className="floating-support" href={env.supportUrl} rel="noreferrer" target="_blank">
            Support
          </a>
        </div>
      </body>
    </html>
  );
}
