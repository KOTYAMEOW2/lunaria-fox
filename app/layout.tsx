import type { Metadata } from "next";
import { publicEnv } from "@/lib/public-env";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

import "./globals.css";

export const metadata: Metadata = {
  title: `${publicEnv.siteName} | STALCRAFT Operations`,
  description: "STALCRAFT-only сайт и дашборд для кланов, КВ, посещаемости, выбросов и профилей игроков.",
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/stalcraft-fox-avatar.png",
  },
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
