import { redirect } from "next/navigation";

import { assertGuildAccess } from "@/lib/auth/access";
import { getSession } from "@/lib/auth/session";
import { getScGuildDashboardData } from "@/lib/stalcraft/sc-dashboard";
import { ScGuildDashboardClient } from "@/components/stalcraft/sc-guild-dashboard-client";

export const dynamic = "force-dynamic";

export default async function GuildDashboardPage({ params }: { params: Promise<{ guildId: string }> }) {
  const session = await getSession();
  const { guildId } = await params;

  if (!session) redirect("/api/auth/discord/login");
  try {
    await assertGuildAccess(session, guildId);
  } catch {
    redirect("/dashboard");
  }

  const data = await getScGuildDashboardData(guildId);

  return (
    <section className="page-shell sc-page-shell">
      <div className="container">
        <div className="page-head sc-page-head">
          <span className="eyebrow sc-eyebrow">STALCRAFT Server Panel</span>
          <h1>{data.guild?.name || `Server ${guildId}`}</h1>
          <p>
            Управление КВ, каналами, ролями, посещаемостью, табами, выбросами и STALCRAFT-логами.
          </p>
        </div>

        <div className="control-grid page-control-grid sc-control-grid">
          <div className="control-card sc-control-card"><strong>Канал КВ</strong><span>{data.settings?.cw_post_channel_id ? "set" : "—"}</span></div>
          <div className="control-card sc-control-card"><strong>Участвуют</strong><span>{data.attendance.filter((row: any) => row.status === "attending").length}</span></div>
          <div className="control-card sc-control-card"><strong>Табы в очереди</strong><span>{data.resultQueue.length}</span></div>
          <div className="control-card sc-control-card"><strong>Выброс</strong><span>{data.emission?.state === "active" ? "active" : "idle"}</span></div>
        </div>

        <ScGuildDashboardClient guildId={guildId} data={data} />
      </div>
    </section>
  );
}
