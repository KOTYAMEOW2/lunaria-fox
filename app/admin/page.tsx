import { redirect } from "next/navigation";

import { assertOwnerSessionAsync } from "@/lib/auth/owners";
import { getSession } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { ScAdminGuildControlClient } from "@/components/stalcraft/sc-admin-guild-control-client";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getSession();
  if (!session) redirect("/api/auth/discord/login?next=/admin");
  try {
    await assertOwnerSessionAsync(session);
  } catch {
    redirect("/dashboard");
  }

  const supabase = getSupabaseAdmin();
  let guilds: any[] = [];
  let latestActions: any[] = [];

  if (supabase) {
    const guildResult = await supabase
      .from("sc_guilds")
      .select("guild_id, name, member_count, is_available, updated_at")
      .eq("is_available", true)
      .order("name");
    guilds = guildResult.data || [];

    if (guilds.length > 0) {
      const actionResult = await supabase
        .from("sc_admin_bot_actions")
        .select("id, guild_id, action, status, reason, error_message, created_at, processed_at")
        .in("guild_id", guilds.map((guild: any) => guild.guild_id))
        .order("created_at", { ascending: false });
      latestActions = actionResult.data || [];
    }
  }

  const latestActionByGuild = new Map<string, any>();
  for (const action of latestActions) {
    if (!latestActionByGuild.has(action.guild_id)) {
      latestActionByGuild.set(action.guild_id, action);
    }
  }

  const guildPayload = guilds.map((guild) => ({
    ...guild,
    latest_action: latestActionByGuild.get(guild.guild_id) || null,
  }));

  return (
    <section className="page-shell sc-page-shell">
      <div className="container">
        <div className="page-head sc-page-head">
          <span className="eyebrow sc-eyebrow">STALCRAFT Admin</span>
          <h1>Глобальный список SC-серверов</h1>
          <p>Панель владельцев для контроля подключённых серверов, заявок на выход бота и технического состояния индекса.</p>
        </div>
        <ScAdminGuildControlClient guilds={guildPayload} />
      </div>
    </section>
  );
}
