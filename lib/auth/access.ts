import { canManageGuild, fetchDiscordGuilds } from "@/lib/auth/discord";
import { isOwnerSession } from "@/lib/auth/owners";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { DiscordSession } from "@/lib/types";

export async function getManageableGuildIds(session: DiscordSession) {
  if (!session.accessToken) {
    throw new Error("Discord reauthorization required.");
  }

  const guilds = await fetchDiscordGuilds(session.accessToken);
  return new Set(guilds.filter(canManageGuild).map((guild) => guild.id));
}

export async function assertGuildAccess(session: DiscordSession | null, guildId: string) {
  if (!session) {
    throw new Error("Unauthorized");
  }

  if (isOwnerSession(session)) {
    return;
  }

  const manageableGuildIds = await getManageableGuildIds(session);
  if (!manageableGuildIds.has(guildId)) {
    const hasClanAccess = await hasOfficerClanAccess(session.userId, guildId);
    if (!hasClanAccess) throw new Error("Forbidden");
  }
}

export function normalizeScAccessLevel(rank: string | null | undefined) {
  const value = String(rank || "").toLowerCase();
  if (/(leader|commander|owner|глава|лидер|командир)/i.test(value)) return "leader";
  if (/(colonel|полков)/i.test(value)) return "colonel";
  if (/(officer|офицер)/i.test(value)) return "officer";
  return "member";
}

export function isOfficerAccessLevel(level: string | null | undefined) {
  return ["leader", "colonel", "officer"].includes(normalizeScAccessLevel(level));
}

async function hasOfficerClanAccess(discordUserId: string, guildId: string) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return false;

  const [{ data: settings }, { data: player }] = await Promise.all([
    supabase.from("sc_guild_settings").select("clan_id").eq("guild_id", guildId).maybeSingle(),
    supabase
      .from("sc_players")
      .select("selected_clan_id, selected_clan_rank")
      .eq("discord_user_id", discordUserId)
      .maybeSingle(),
  ]);

  if (!settings?.clan_id || player?.selected_clan_id !== settings.clan_id) return false;
  if (isOfficerAccessLevel(player?.selected_clan_rank)) return true;

  const { data: access } = await supabase
    .from("sc_clan_access")
    .select("access_level")
    .eq("clan_id", settings.clan_id)
    .eq("discord_user_id", discordUserId)
    .maybeSingle();

  return isOfficerAccessLevel(access?.access_level);
}
