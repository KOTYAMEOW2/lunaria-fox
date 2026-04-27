import { redirect } from "next/navigation";
import { assertGuildAccess } from "@/lib/auth/access";
import { getSession } from "@/lib/auth/session";
import { getGuildDashboardData } from "@/lib/data/dashboard-read";
import { getStalcraftGuildSettings } from "@/lib/stalcraft/data";
import { StalcraftGuildSettingsClient } from "@/components/stalcraft/stalcraft-guild-settings-client";

export const dynamic = "force-dynamic";

export default async function GuildStalcraftPage({ params }: { params: Promise<{ guildId: string }> }) {
  const session = await getSession();
  const { guildId } = await params;
  if (!session) redirect("/api/auth/discord/login");
  try { await assertGuildAccess(session, guildId); } catch { redirect("/dashboard"); }

  const [data, settings] = await Promise.all([
    getGuildDashboardData(guildId),
    getStalcraftGuildSettings(guildId).catch(() => null),
  ]);

  return (
    <section className="page-shell">
      <div className="container">
        <div className="page-head">
          <span className="eyebrow">Guild Dashboard</span>
          <h1>{data.guild?.name || `Server ${guildId}`} · STALCRAFT</h1>
          <p>Включи STALCRAFT-комьюнити, настрой verified-роль и доступ к STALCRAFT Video.</p>
          <div className="stack-actions" style={{ marginTop: 16 }}>
            <a className="ghost-button" href={`/dashboard/${guildId}`}>Назад в Dashboard</a>
            <a className="secondary-button" href="/stalcraft">Моя привязка STALCRAFT</a>
          </div>
        </div>
        <StalcraftGuildSettingsClient guildId={guildId} initial={settings} />
      </div>
    </section>
  );
}
