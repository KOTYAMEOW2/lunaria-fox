"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";

import {
  buildDashboardLoginUrl,
  buildDashboardLogoutUrl,
  buildDashboardUrl,
  isExternalDashboard,
  publicEnv,
} from "@/lib/public-env";

type SessionPreview = {
  username: string;
  globalName: string | null;
  avatar: string | null;
  isOwner?: boolean;
  stalcraftLinked?: boolean;
};

export function SiteHeader() {
  const [session, setSession] = useState<SessionPreview | null>(null);

  useEffect(() => {
    if (isExternalDashboard()) return;

    let cancelled = false;

    fetch("/api/auth/session", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return { session: null };
        return (await response.json()) as { session: SessionPreview | null };
      })
      .then((payload) => {
        if (!cancelled) setSession(payload.session ?? null);
      })
      .catch(() => {
        if (!cancelled) setSession(null);
      });

    return () => { cancelled = true; };
  }, []);

  return (
    <header className="site-header">
      <div className="container site-header-row">
        <Link className="brand-lockup" href="/">
          <span className="brand-mark" />
          <span>
            <span className="brand-title">{publicEnv.siteName}</span>
            <span className="brand-subtitle">STALCRAFT Operations</span>
          </span>
        </Link>

        <nav className="header-nav">
          <Link className="nav-pill" href="/stalcraft">STALCRAFT</Link>
          {session?.stalcraftLinked ? <Link className="nav-pill" href="/stalcraft-video">Video</Link> : null}
          <a className="secondary-button" href={publicEnv.inviteUrl} rel="noreferrer" target="_blank">Invite Bot</a>
          {session ? (
            <>
              <a className="ghost-button" href={buildDashboardUrl("/dashboard")}>Dashboard</a>
              <span className="session-chip">
                {session.avatar ? <Image alt={session.username} height={28} src={session.avatar} unoptimized width={28} /> : null}
                <span>{session.globalName || session.username}</span>
              </span>
              <a className="ghost-button" href={buildDashboardLogoutUrl()}>Logout</a>
            </>
          ) : (
            <a className="primary-button" href={buildDashboardLoginUrl()}>Login with Discord</a>
          )}
        </nav>
      </div>
    </header>
  );
}
