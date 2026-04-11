import Link from "next/link";
import { redirect } from "next/navigation";

import { assertOwnerSession, isOwnerSession } from "@/lib/auth/owners";
import { getSession } from "@/lib/auth/session";
import { getAdminManagedGuilds } from "@/lib/data/dashboard-read";

function fmtDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function statusBadge(status: string | null) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "applied") return "success";
  if (normalized === "error") return "danger";
  if (normalized === "processing" || normalized === "queued") return "warn";
  return "";
}

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getSession();

  if (!session) {
    redirect("/api/auth/discord/login?next=/admin");
  }

  try {
    assertOwnerSession(session);
  } catch {
    redirect("/dashboard");
  }

  const guilds = await getAdminManagedGuilds();
  const totalGuilds = guilds.length;
  const availableGuilds = guilds.filter((guild) => guild.isAvailable).length;
  const premiumGuilds = guilds.filter((guild) => guild.premiumActive).length;
  const pendingSyncGuilds = guilds.filter((guild) => guild.syncRevision > guild.appliedRevision).length;

  return (
    <section className="page-shell">
      <div className="container">
        <div className="page-head">
          <span className="eyebrow">Admin Panel</span>
          <h1>Глобальное управление Lunaria Fox</h1>
          <p>
            Панель доступна только owner ID. Здесь видны все серверы из индекса бота, а переход по кнопке открывает
            полный guild dashboard даже без обычных Discord manage-rights на этом аккаунте.
          </p>
        </div>

        <div className="control-grid page-control-grid">
          <div className="control-card">
            <strong>Tracked guilds</strong>
            <span>{totalGuilds}</span>
          </div>
          <div className="control-card">
            <strong>Available now</strong>
            <span>{availableGuilds}</span>
          </div>
          <div className="control-card">
            <strong>Premium guilds</strong>
            <span>{premiumGuilds}</span>
          </div>
          <div className="control-card">
            <strong>Pending sync</strong>
            <span>{pendingSyncGuilds}</span>
          </div>
        </div>

        <div className="guild-grid">
          {guilds.map((guild) => (
            <article className="guild-card" key={guild.id}>
              <div className="guild-card-header">
                <div>
                  <h3>{guild.name}</h3>
                  <p>
                    {guild.preferredLocale.toUpperCase()} locale · owner{" "}
                    {guild.ownerId ? <code>{guild.ownerId}</code> : "—"}
                  </p>
                </div>
                <div className="stack-actions" style={{ alignItems: "flex-end" }}>
                  <span className={`badge ${guild.isAvailable ? "success" : "warn"}`}>
                    {guild.isAvailable ? "Available" : "Unavailable"}
                  </span>
                  <span className={`badge ${statusBadge(guild.syncStatus)}`}>
                    {guild.syncStatus || "no sync"}
                  </span>
                  {guild.premiumActive ? (
                    <span className="badge success">{guild.premiumPlan || "Premium"}</span>
                  ) : null}
                </div>
              </div>

              <p style={{ marginTop: 12 }}>
                Участников: {guild.memberCount}. Sync: {guild.appliedRevision}/{guild.syncRevision}. Последний apply:{" "}
                {fmtDate(guild.botAppliedAt)}.
              </p>

              {guild.syncError ? <p className="page-alert">Sync error: {guild.syncError}</p> : null}

              <div className="stack-actions" style={{ marginTop: 18 }}>
                <Link className="primary-button" href={`/dashboard/${guild.id}`}>
                  Open Guild Dashboard
                </Link>
                <Link className="ghost-button" href="/dashboard">
                  Standard Dashboard
                </Link>
              </div>

              <div className="admin-meta-grid">
                <div className="control-card">
                  <strong>Guild ID</strong>
                  <span>{guild.id}</span>
                </div>
                <div className="control-card">
                  <strong>Last bot seen</strong>
                  <span>{fmtDate(guild.botSeenAt)}</span>
                </div>
                <div className="control-card">
                  <strong>Updated in index</strong>
                  <span>{fmtDate(guild.updatedAt)}</span>
                </div>
              </div>
            </article>
          ))}
        </div>

        {isOwnerSession(session) && guilds.length === 0 ? (
          <p className="page-alert">Индекс `bot_guilds` пока пуст. Бот должен подняться и синхронизировать серверы.</p>
        ) : null}
      </div>
    </section>
  );
}
