import { redirect } from "next/navigation";
import Link from "next/link";

import { assertGuildAccess } from "@/lib/auth/access";
import { getSession } from "@/lib/auth/session";
import { getGuildDashboardData } from "@/lib/data/dashboard-read";
import { GuildDashboardClient } from "@/components/dashboard/guild-dashboard-client";

export const dynamic = "force-dynamic";

export default async function GuildDashboardPage({ params }: { params: Promise<{ guildId: string }> }) {
  const session = await getSession();
  const { guildId } = await params;

  if (!session) redirect("/api/auth/discord/login");

  try { await assertGuildAccess(session, guildId); } catch { redirect("/dashboard"); }

  const data = await getGuildDashboardData(guildId);

  return (
    <section className="page-shell">
      <div className="container">
        <div className="page-head">
          <span className="eyebrow">Guild Dashboard</span>
          <h1>{data.guild?.name || `Server ${guildId}`}</h1>
          <p>
            Здесь меняются команды, модули, тикеты, VoiceMaster, брендинг и premium-настройки. После сохранения панель
            показывает, когда бот применил новые параметры.
          </p>
          <div className="stack-actions" style={{ marginTop: 16 }}>
            <Link className="secondary-button" href={`/dashboard/${guildId}/stalcraft`}>
              STALCRAFT Settings
            </Link>
          </div>
        </div>

        <div className="control-grid page-control-grid">
          <div className="control-card"><strong>Channels indexed</strong><span>{data.channels.length}</span></div>
          <div className="control-card"><strong>Roles indexed</strong><span>{data.roles.length}</span></div>
          <div className="control-card"><strong>Commands tracked</strong><span>{data.commandsRegistry.length}</span></div>
          <div className="control-card"><strong>Sync revision</strong><span>{data.syncState?.revision || 0}</span></div>
        </div>

        <GuildDashboardClient guildId={guildId} data={data} />
      </div>
    </section>
  );
}
