import { redirect } from "next/navigation";

import { assertGuildAccess } from "@/lib/auth/access";
import { getSession } from "@/lib/auth/session";
import { getGuildDashboardData } from "@/lib/data/dashboard-read";
import { GuildDashboardClient } from "@/components/dashboard/guild-dashboard-client";

export const dynamic = "force-dynamic";

export default async function GuildDashboardPage({
  params,
}: {
  params: Promise<{ guildId: string }>;
}) {
  const session = await getSession();
  const { guildId } = await params;

  if (!session) {
    redirect("/api/auth/discord/login");
  }

  try {
    await assertGuildAccess(session, guildId);
  } catch {
    redirect("/dashboard");
  }

  const data = await getGuildDashboardData(guildId);

  return (
    <section className="page-shell">
      <div className="container">
        <div className="page-head">
          <span className="eyebrow">Guild Dashboard</span>
          <h1>{data.guild?.name || `Server ${guildId}`}</h1>
          <p>
            Дашборд пишет прямо в Supabase-таблицы Lunaria Fox. Всё, что меняется здесь, строится вокруг той же
            `guild_id`-centric модели, что и у самого бота.
          </p>
        </div>

        <GuildDashboardClient guildId={guildId} data={data} />
      </div>
    </section>
  );
}
