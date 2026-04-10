import Link from "next/link";

import { buildDashboardUrl, publicEnv } from "@/lib/public-env";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container site-footer-row">
        <div>
          <div className="brand-title">{publicEnv.siteName}</div>
          <p className="muted">
            Лунно-фиолетовая платформа для управления Discord-ботом через единый Supabase-backed дашборд.
          </p>
        </div>

        <div className="header-nav">
          <Link className="nav-pill" href="/docs">
            Docs
          </Link>
          <Link className="nav-pill" href="/commands">
            Commands
          </Link>
          <a className="nav-pill" href={buildDashboardUrl("/dashboard")}>
            Dashboard
          </a>
          <a className="nav-pill" href={publicEnv.supportUrl} rel="noreferrer" target="_blank">
            Support
          </a>
        </div>
      </div>
    </footer>
  );
}
