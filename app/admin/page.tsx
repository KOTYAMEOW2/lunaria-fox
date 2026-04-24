import { redirect } from "next/navigation";

import { AdminPremiumControlPlane } from "@/components/admin/admin-premium-control-plane";
import { assertOwnerSession, isOwnerSession } from "@/lib/auth/owners";
import { getSession } from "@/lib/auth/session";
import { getAdminManagedGuilds } from "@/lib/data/dashboard-read";

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

        <AdminPremiumControlPlane guilds={guilds} />

        {isOwnerSession(session) && guilds.length === 0 ? (
          <p className="page-alert">Индекс `bot_guilds` пока пуст. Бот должен подняться и синхронизировать серверы.</p>
        ) : null}
      </div>
    </section>
  );
}
