import Link from "next/link";
import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth/session";
import { getScManagedGuilds } from "@/lib/stalcraft/sc-dashboard";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/api/auth/discord/login");

  const guilds = await getScManagedGuilds(session);

  return (
    <section className="page-shell sc-page-shell">
      <div className="container">
        <div className="page-head sc-page-head">
          <span className="eyebrow sc-eyebrow">STALCRAFT Dashboard</span>
          <h1>Выбери сервер клана</h1>
          <p>Настрой каналы, роли, КВ, табы и выбросы для выбранного Discord-сервера.</p>
        </div>

        <div className="guild-grid sc-guild-grid">
          {guilds.map((guild) => (
            <article className="guild-card sc-guild-card" key={guild.id}>
              <div className="guild-card-header">
                <div>
                  <h3>{guild.name}</h3>
                  <p>{guild.clanName || "Клан ещё не выбран"}</p>
                </div>
                <span className={`badge ${guild.installed ? "success" : "warn"}`}>
                  {guild.installed ? "Бот подключён" : "Бот не найден"}
                </span>
              </div>
              <p style={{ marginTop: 12 }}>
                {guild.installed
                  ? `Участников на сервере: ${guild.memberCount}.`
                  : "Добавь Lunaria Fox на сервер и открой эту страницу после синхронизации."}
              </p>
              <div className="stack-actions" style={{ marginTop: 18 }}>
                <Link className="primary-button sc-primary" href={`/dashboard/${guild.id}/settings`}>
                  Открыть штаб сервера
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
