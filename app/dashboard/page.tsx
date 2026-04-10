import Link from "next/link";
import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth/session";
import { getManagedGuilds } from "@/lib/data/dashboard-read";

export default async function DashboardPage() {
  const session = await getSession();

  if (!session) {
    redirect("/api/auth/discord/login");
  }

  const guilds = await getManagedGuilds(session);

  return (
    <section className="page-shell">
      <div className="container">
        <div className="page-head">
          <span className="eyebrow">Dashboard</span>
          <h1>Выбери сервер для управления</h1>
          <p>
            Список строится из Discord OAuth `users/@me/guilds`, затем склеивается с `bot_guilds` в Supabase, чтобы было
            видно, где бот уже установлен и синхронизирован.
          </p>
        </div>

        <div className="guild-grid">
          {guilds.map((guild) => (
            <article className="guild-card" key={guild.id}>
              <div className="guild-card-header">
                <div>
                  <h3>{guild.name}</h3>
                  <p>{guild.preferredLocale.toUpperCase()} locale</p>
                </div>
                <span className={`badge ${guild.installed ? "success" : "warn"}`}>
                  {guild.installed ? "Installed" : "Not synced"}
                </span>
              </div>
              <p style={{ marginTop: 12 }}>
                {guild.installed
                  ? `Доступен в Supabase. Участников: ${guild.memberCount}.`
                  : "OAuth доступ есть, но бот ещё не отдал по нему актуальный guild index в Supabase."}
              </p>
              <div className="stack-actions" style={{ marginTop: 18 }}>
                <Link className="primary-button" href={`/dashboard/${guild.id}`}>
                  Open Server
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
