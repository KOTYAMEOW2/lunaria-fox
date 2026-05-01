import { canManageGuild, fetchDiscordGuilds } from "@/lib/auth/discord";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { DiscordSession } from "@/lib/types";

export type ScManagedGuild = {
  id: string;
  name: string;
  icon: string | null;
  installed: boolean;
  memberCount: number;
  clanName: string | null;
  isAvailable: boolean;
};

export type ScGuildDashboardData = {
  guild: any | null;
  settings: any | null;
  channels: any[];
  discordRoles: any[];
  scRoles: any[];
  currentSession: any | null;
  attendance: any[];
  resultQueue: any[];
  clanMembers: any[];
  clanStats: any[];
  logs: any[];
  emission: any | null;
};

const BOT_GUILD_STALE_MS = 20 * 60 * 1000;

function supabase() {
  const client = getSupabaseAdmin();
  if (!client) throw new Error("Supabase is not configured.");
  return client;
}

function isFreshBotGuild(row: any) {
  if (!row || row.is_available === false) return false;
  const updatedAt = row.updated_at ? Date.parse(row.updated_at) : 0;
  return Number.isFinite(updatedAt) && Date.now() - updatedAt <= BOT_GUILD_STALE_MS;
}

export async function getScManagedGuilds(session: DiscordSession | null): Promise<ScManagedGuild[]> {
  if (!session) return [];
  if (!session.accessToken) return [];

  const discordGuilds = (await fetchDiscordGuilds(session.accessToken)).filter(canManageGuild);
  if (discordGuilds.length === 0) return [];

  const guildIds = discordGuilds.map((guild) => guild.id);
  const [{ data: indexed }, { data: settings }] = await Promise.all([
    supabase()
      .from("sc_guilds")
      .select("guild_id, name, icon, member_count, is_available, updated_at")
      .in("guild_id", guildIds),
    supabase()
      .from("sc_guild_settings")
      .select("guild_id, clan_name, community_name")
      .in("guild_id", guildIds),
  ]);

  const indexedById = new Map<string, any>((indexed || []).map((row: any) => [row.guild_id, row]));
  const settingsById = new Map<string, any>((settings || []).map((row: any) => [row.guild_id, row]));

  return discordGuilds.map((guild) => {
    const tracked = indexedById.get(guild.id);
    const config = settingsById.get(guild.id);
    const installed = isFreshBotGuild(tracked);
    return {
      id: guild.id,
      name: tracked?.name || guild.name,
      icon: tracked?.icon || guild.icon || null,
      installed,
      memberCount: Number(tracked?.member_count || 0),
      clanName: config?.clan_name || config?.community_name || null,
      isAvailable: installed,
    };
  });
}

export async function getScGuildDashboardData(guildId: string): Promise<ScGuildDashboardData> {
  const [
    guild,
    settings,
    channels,
    discordRoles,
    scRoles,
    session,
    resultQueue,
    logs,
    emission,
  ] = await Promise.all([
    supabase().from("sc_guilds").select("*").eq("guild_id", guildId).maybeSingle(),
    supabase().from("sc_guild_settings").select("*").eq("guild_id", guildId).maybeSingle(),
    supabase().from("sc_discord_channels").select("*").eq("guild_id", guildId).order("position"),
    supabase().from("sc_discord_roles").select("*").eq("guild_id", guildId).order("position", { ascending: false }),
    supabase().from("sc_roles").select("*").eq("guild_id", guildId).order("role_key"),
    supabase().from("sc_cw_sessions").select("*").eq("guild_id", guildId).order("cw_date", { ascending: false }).limit(1),
    supabase().from("sc_cw_result_queue").select("*").eq("guild_id", guildId).order("score", { ascending: false }),
    supabase().from("sc_logs").select("*").eq("guild_id", guildId).order("created_at", { ascending: false }).limit(30),
    supabase().from("sc_emission_state").select("*").eq("guild_id", guildId).maybeSingle(),
  ]);

  const settingsRow = settings.data || null;
  const currentSession = Array.isArray(session.data) && session.data.length > 0 ? session.data[0] : null;
  const clanId = settingsRow?.clan_id || null;

  const [attendance, clanMembers, clanStats] = await Promise.all([
    currentSession
      ? supabase().from("sc_cw_attendance").select("*").eq("session_id", currentSession.id).order("responded_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    clanId
      ? supabase().from("sc_clan_members").select("*").eq("clan_id", clanId).order("character_name")
      : Promise.resolve({ data: [] }),
    clanId
      ? supabase().from("sc_clan_attendance_stats").select("*").eq("clan_id", clanId).order("character_name")
      : Promise.resolve({ data: [] }),
  ]);

  return {
    guild: guild.data || null,
    settings: settingsRow,
    channels: channels.data || [],
    discordRoles: discordRoles.data || [],
    scRoles: scRoles.data || [],
    currentSession,
    attendance: attendance.data || [],
    resultQueue: resultQueue.data || [],
    clanMembers: clanMembers.data || [],
    clanStats: clanStats.data || [],
    logs: logs.data || [],
    emission: emission.data || null,
  };
}

export async function saveScGuildSettings(
  guildId: string,
  userId: string,
  payload: {
    community_name: string | null;
    clan_id: string | null;
    clan_name: string | null;
    region: string | null;
    cw_post_channel_id: string | null;
    absence_channel_id: string | null;
    results_channel_id: string | null;
    emission_channel_id: string | null;
    logs_channel_id: string | null;
    sc_commands_channel_id: string | null;
    auto_create_roles: boolean;
    roles: Array<{ role_key: string; role_id: string | null; role_name: string | null }>;
  },
) {
  const now = new Date().toISOString();
  const { error: settingsError } = await supabase().from("sc_guild_settings").upsert(
    {
      guild_id: guildId,
      community_name: payload.community_name,
      clan_id: payload.clan_id,
      clan_name: payload.clan_name,
      required_clan_id: payload.clan_id,
      required_clan_name: payload.clan_name,
      region: payload.region || null,
      cw_post_hour_msk: 14,
      cw_start_hour_msk: 20,
      cw_post_channel_id: payload.cw_post_channel_id,
      absence_channel_id: payload.absence_channel_id,
      results_channel_id: payload.results_channel_id,
      emission_channel_id: payload.emission_channel_id,
      logs_channel_id: payload.logs_channel_id,
      sc_commands_channel_id: payload.sc_commands_channel_id,
      auto_create_roles: payload.auto_create_roles,
      updated_by: userId,
      updated_at: now,
    },
    { onConflict: "guild_id" },
  );
  if (settingsError) throw settingsError;

  const roleRows = payload.roles
    .filter((role) => role.role_key)
    .map((role) => ({
      guild_id: guildId,
      role_key: role.role_key,
      role_id: role.role_id,
      role_name: role.role_name,
      auto_created: false,
      updated_at: now,
    }));

  if (roleRows.length > 0) {
    const { error } = await supabase().from("sc_roles").upsert(roleRows, { onConflict: "guild_id,role_key" });
    if (error) throw error;
  }
}

export async function addCwResultRows(
  guildId: string,
  userId: string,
  rows: Array<{
    character_name: string;
    matches_count?: number;
    kills: number;
    deaths: number;
    assists: number;
    treasury_spent: number;
    score: number;
  }>,
) {
  if (rows.length === 0) return 0;
  const { data: settings } = await supabase()
    .from("sc_guild_settings")
    .select("clan_id")
    .eq("guild_id", guildId)
    .maybeSingle();
  const payload = rows.map((row) => ({
    guild_id: guildId,
    clan_id: settings?.clan_id || null,
    character_name: row.character_name,
    matches_count: row.matches_count || 1,
    kills: row.kills,
    deaths: row.deaths,
    assists: row.assists,
    treasury_spent: row.treasury_spent,
    score: row.score,
    uploaded_by: userId,
    raw: row,
  }));
  const { error } = await supabase().from("sc_cw_result_queue").insert(payload);
  if (error) throw error;
  return payload.length;
}

export async function getClanDashboardForUser(session: DiscordSession, clanId: string) {
  const [{ data: player }, { data: member }] = await Promise.all([
    supabase().from("sc_players").select("*").eq("discord_user_id", session.userId).maybeSingle(),
    supabase()
      .from("sc_clan_members")
      .select("*")
      .eq("clan_id", clanId)
      .eq("discord_user_id", session.userId)
      .maybeSingle(),
  ]);

  if (player?.selected_clan_id !== clanId && !member) {
    throw new Error("Forbidden");
  }

  const [clan, stats, sessions, logs] = await Promise.all([
    supabase().from("sc_clans").select("*").eq("clan_id", clanId).maybeSingle(),
    supabase().from("sc_clan_attendance_stats").select("*").eq("clan_id", clanId).order("character_name"),
    supabase().from("sc_cw_sessions").select("*").eq("clan_id", clanId).order("cw_date", { ascending: false }).limit(20),
    supabase().from("sc_logs").select("*").eq("clan_id", clanId).order("created_at", { ascending: false }).limit(30),
  ]);

  return {
    player,
    member,
    clan: clan.data || null,
    stats: stats.data || [],
    sessions: sessions.data || [],
    logs: logs.data || [],
  };
}
