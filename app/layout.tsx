import type { Metadata } from "next";
import { publicEnv } from "@/lib/public-env";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

import "./globals.css";

export const metadata: Metadata = {
  title: `${publicEnv.siteName} | Discord Bot Dashboard`,
  description: "Сайт Lunaria Fox с командами, документацией и дашбордом для настройки Discord-бота.",
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
