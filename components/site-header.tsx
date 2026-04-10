import Image from "next/image";
import Link from "next/link";

import { env } from "@/lib/env";
import type { DiscordSession } from "@/lib/types";

export function SiteHeader({ session }: { session: DiscordSession | null }) {
  return (
    <header className="site-header">
      <div className="container site-header-row">
        <Link className="brand-lockup" href="/">
          <span className="brand-mark" />
          <span>
            <span className="brand-title">{env.siteName}</span>
            <span className="brand-subtitle">Discord Bot Control Plane</span>
          </span>
        </Link>

        <nav className="header-nav">
          <Link className="nav-pill" href="/features">
            Features
          </Link>
          <Link className="nav-pill" href="/commands">
            Commands
          </Link>
          <Link className="nav-pill" href="/pricing">
            Pricing
          </Link>
          <Link className="nav-pill" href="/docs">
            Docs
          </Link>
          <a className="secondary-button" href={env.inviteUrl} rel="noreferrer" target="_blank">
            Invite Bot
          </a>
          {session ? (
            <>
              <Link className="ghost-button" href="/dashboard">
                Dashboard
              </Link>
              <span className="session-chip">
                {session.avatar ? (
                  <Image alt={session.username} height={28} src={session.avatar} unoptimized width={28} />
                ) : null}
                <span>{session.globalName || session.username}</span>
              </span>
              <Link className="ghost-button" href="/api/auth/logout">
                Logout
              </Link>
            </>
          ) : (
            <Link className="primary-button" href="/api/auth/discord/login">
              Login with Discord
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
