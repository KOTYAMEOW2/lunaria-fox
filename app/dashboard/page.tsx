import Link from "next/link";
import { redirect } from "next/navigation";

import { isOwnerSession } from "@/lib/auth/owners";
import { getSession } from "@/lib/auth/session";
import { getManagedGuilds } from "@/lib/data/dashboard-read";

function getAuthMessage(code: string | undefined) {
  if (code === "missing_supabase_auth") {
    return "На сайте не хватает настроек Supabase Auth. Проверь переменные Vercel и Discord provider в Supabase.";
  }

  if (code === "oauth_start") {
    return "Не удалось начать вход через Discord. Проверь настройки Supabase Auth и redirect URLs.";
  }

  if (code === "oauth_callback") {
    return "Discord вернул callback, но сессия не создалась. Обычно это проблема в redirect URLs или Discord provider.";
  }

  return null;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ auth_error?: string }>;
}) {
  const session = await getSession();
  const resolvedSearchParams = (await searchParams) || {};
  const authMessage = getAuthMessage(resolvedSearchParams.auth_error);

  if (!session && !authMessage) {
    redirect("/api/auth/discord/login");
  }

  if (!session) {
    return (
      <section className="page-shell">
        <div className="container">
          <div className="page-head">
            <span className="eyebrow">Dashboard</span>
            <h1>Вход в панель</h1>
            <p className="page-alert">{authMessage || "Нужно войти через Discord."}</p>
          </div>
          <div className="stack-actions">
            <Link className="primary-button" href="/api/auth/discord/login">
              Login with Discord
            </Link>
            <Link className="ghost-button" href="/docs">
              Open Docs
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const guilds = await getManagedGuilds(session);
  const owner = isOwnerSession(session);

  return (
    <section className="page-shell">
      <div className="container">
        <div className="page-head">
          <span className="eyebrow">Dashboard</span>
          <h1>Выбери сервер для управления</h1>
          <p>Здесь показаны серверы, где у тебя есть право управления и где можно открыть панель Lunaria Fox.</p>
          {authMessage ? <p className="page-alert">{authMessage}</p> : null}
          {owner ? (
            <div className="stack-actions" style={{ marginTop: 16 }}>
              <Link className="primary-button" href="/admin">
                Open Admin Panel
              </Link>
            </div>
          ) : null}
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
                  ? `Бот уже доступен на сервере. Участников: ${guild.memberCount}.`
                  : "У тебя есть доступ к серверу, но бот ещё не подключен или не обновил данные."}
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
