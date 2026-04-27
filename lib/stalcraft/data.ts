import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  exchangeStalcraftCode,
  fetchExboUser,
  fetchStalcraftCharacters,
  refreshStalcraftToken,
} from "@/lib/stalcraft/api";
import type {
  StalcraftCharacterCacheRow,
  StalcraftCommunityRow,
  StalcraftGuildSettingsRow,
  StalcraftProfileRow,
  StalcraftRegion,
  StalcraftVideoRow,
} from "@/lib/stalcraft/types";

export const STALCRAFT_REGIONS: StalcraftRegion[] = ["RU", "EU", "NA", "SEA"];

function requireSupabase() {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

function tokenExpiry(expiresIn: number) {
  return new Date(Date.now() + Math.max(0, expiresIn - 60) * 1000).toISOString();
}

export async function getStalcraftProfile(discordUserId: string) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("stalcraft_profiles")
    .select("*")
    .eq("discord_user_id", discordUserId)
    .maybeSingle();

  if (error) throw error;
  return (data || null) as StalcraftProfileRow | null;
}

export async function linkStalcraftProfileFromCode(discordUserId: string, code: string) {
  const supabase = requireSupabase();
  const tokens = await exchangeStalcraftCode(code);
  const user = await fetchExboUser(tokens.access_token);
  const now = new Date().toISOString();

  const row = {
    discord_user_id: discordUserId,
    exbo_id: String(user.id),
    exbo_uuid: user.uuid || null,
    exbo_login: user.login || null,
    exbo_display_login: user.display_login || user.login || null,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token || null,
    token_type: tokens.token_type || "Bearer",
    token_expires_at: tokenExpiry(tokens.expires_in || 3600),
    updated_at: now,
    linked_at: now,
  };

  const { error } = await supabase.from("stalcraft_profiles").upsert(row, { onConflict: "discord_user_id" });
  if (error) throw error;

  return syncStalcraftCharacters(discordUserId);
}

export async function ensureFreshStalcraftAccessToken(profile: StalcraftProfileRow) {
  if (!profile.access_token) throw new Error("STALCRAFT profile has no access token.");

  const expiresAt = profile.token_expires_at ? new Date(profile.token_expires_at).getTime() : 0;
  if (!profile.refresh_token || expiresAt > Date.now() + 60_000) {
    return profile.access_token;
  }

  const supabase = requireSupabase();
  const tokens = await refreshStalcraftToken(profile.refresh_token);
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("stalcraft_profiles")
    .update({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || profile.refresh_token,
      token_type: tokens.token_type || profile.token_type || "Bearer",
      token_expires_at: tokenExpiry(tokens.expires_in || 3600),
      updated_at: now,
    })
    .eq("discord_user_id", profile.discord_user_id);

  if (error) throw error;
  return tokens.access_token;
}

export async function syncStalcraftCharacters(discordUserId: string) {
  const profile = await getStalcraftProfile(discordUserId);
  if (!profile) throw new Error("STALCRAFT profile is not linked.");

  const supabase = requireSupabase();
  const accessToken = await ensureFreshStalcraftAccessToken(profile);
  const characterRows: StalcraftCharacterCacheRow[] = [];

  for (const region of STALCRAFT_REGIONS) {
    try {
      const rows = await fetchStalcraftCharacters(region, accessToken);
      characterRows.push(...rows.map((row) => ({ ...row, discord_user_id: discordUserId })));
    } catch (error) {
      console.warn(`[stalcraft] character sync failed for ${region}:`, error);
    }
  }

  if (characterRows.length > 0) {
    const { error } = await supabase.from("stalcraft_characters_cache").upsert(characterRows, {
      onConflict: "discord_user_id,region,character_id",
    });
    if (error) throw error;
  }

  return characterRows;
}

export async function listStalcraftCharacters(discordUserId: string) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("stalcraft_characters_cache")
    .select("*")
    .eq("discord_user_id", discordUserId)
    .order("region")
    .order("character_name");

  if (error) throw error;
  return (data || []) as StalcraftCharacterCacheRow[];
}

export async function selectStalcraftCharacter(
  discordUserId: string,
  region: StalcraftRegion,
  characterId: string,
) {
  const supabase = requireSupabase();
  const { data: character, error: characterError } = await supabase
    .from("stalcraft_characters_cache")
    .select("*")
    .eq("discord_user_id", discordUserId)
    .eq("region", region)
    .eq("character_id", characterId)
    .maybeSingle();

  if (characterError) throw characterError;
  if (!character) throw new Error("Character was not found in your STALCRAFT account.");

  const row = character as StalcraftCharacterCacheRow;
  const { error } = await supabase
    .from("stalcraft_profiles")
    .update({
      selected_region: region,
      selected_character_id: row.character_id,
      selected_character_name: row.character_name,
      selected_clan_id: row.clan_id,
      selected_clan_name: row.clan_name,
      selected_clan_rank: row.clan_rank,
      updated_at: new Date().toISOString(),
    })
    .eq("discord_user_id", discordUserId);

  if (error) throw error;
  return row;
}

export async function unlinkStalcraftProfile(discordUserId: string) {
  const supabase = requireSupabase();
  const [{ error: profileError }, { error: cacheError }] = await Promise.all([
    supabase.from("stalcraft_profiles").delete().eq("discord_user_id", discordUserId),
    supabase.from("stalcraft_characters_cache").delete().eq("discord_user_id", discordUserId),
  ]);

  if (profileError) throw profileError;
  if (cacheError) throw cacheError;
}

export async function getStalcraftGuildSettings(guildId: string) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("stalcraft_guild_settings")
    .select("*")
    .eq("guild_id", guildId)
    .maybeSingle();

  if (error) throw error;
  return (data || null) as StalcraftGuildSettingsRow | null;
}

export async function saveStalcraftGuildSettings(
  guildId: string,
  discordUserId: string,
  payload: {
    enabled: boolean;
    commandsEnabled: boolean;
    videoEnabled: boolean;
    autoSyncRoles: boolean;
    communityName: string | null;
    requiredClanId: string | null;
    requiredClanName: string | null;
    verifiedRoleId: string | null;
    verifiedRoleName: string;
    roleAutoCreate: boolean;
  },
) {
  const supabase = requireSupabase();
  const now = new Date().toISOString();
  const profile = await getStalcraftProfile(discordUserId);

  if (payload.enabled && !profile?.selected_character_id) {
    throw new Error("Перед включением STALCRAFT-сервера привяжи EXBO-профиль и выбери персонажа.");
  }

  const { data, error } = await supabase
    .from("stalcraft_guild_settings")
    .upsert(
      {
        guild_id: guildId,
        enabled: payload.enabled,
        commands_enabled: payload.commandsEnabled,
        video_enabled: payload.videoEnabled,
        auto_sync_roles: payload.autoSyncRoles,
        community_name: payload.communityName || profile?.selected_clan_name || profile?.selected_character_name || null,
        required_clan_id: payload.requiredClanId || profile?.selected_clan_id || null,
        required_clan_name: payload.requiredClanName || profile?.selected_clan_name || null,
        verified_role_id: payload.verifiedRoleId,
        verified_role_name: payload.verifiedRoleName || "STALCRAFT Verified",
        role_auto_create: payload.roleAutoCreate,
        updated_by: discordUserId,
        updated_at: now,
      },
      { onConflict: "guild_id" },
    )
    .select("*")
    .single();

  if (error) throw error;

  await supabase.from("dashboard_sync_states").upsert(
    {
      guild_id: guildId,
      requested_at: now,
      requested_by: discordUserId,
      requested_source: "dashboard",
      last_section: "stalcraft",
      changed_keys: [
        "stalcraft_guild_settings.enabled",
        "stalcraft_guild_settings.commands_enabled",
        "stalcraft_guild_settings.video_enabled",
        "stalcraft_guild_settings.auto_sync_roles",
        "stalcraft_guild_settings.verified_role_id",
        "stalcraft_guild_settings.verified_role_name",
      ],
      site_updated_at: now,
      status: "queued",
      last_error: null,
      meta: {
        stalcraftEnabled: payload.enabled,
        videoEnabled: payload.videoEnabled,
        autoSyncRoles: payload.autoSyncRoles,
        requiredClanName: payload.requiredClanName || profile?.selected_clan_name || null,
      },
    },
    { onConflict: "guild_id" },
  );

  return data as StalcraftGuildSettingsRow;
}

export async function listEnabledStalcraftCommunities() {
  const supabase = requireSupabase();
  const { data: settings, error } = await supabase
    .from("stalcraft_guild_settings")
    .select("guild_id, community_name, required_clan_name, video_enabled, verified_role_name, updated_at")
    .eq("enabled", true)
    .order("updated_at", { ascending: false })
    .limit(80);

  if (error) throw error;

  const rows = (settings || []) as Array<{
    guild_id: string;
    community_name: string | null;
    required_clan_name: string | null;
    video_enabled: boolean | null;
    verified_role_name: string | null;
    updated_at: string | null;
  }>;

  if (rows.length === 0) return [] as StalcraftCommunityRow[];

  const guildIds = rows.map((row) => row.guild_id);
  const { data: guilds } = await supabase
    .from("bot_guilds")
    .select("guild_id, name, icon")
    .in("guild_id", guildIds);

  const guildById = new Map(
    ((guilds || []) as Array<{ guild_id: string; name: string | null; icon: string | null }>).map((guild) => [
      guild.guild_id,
      guild,
    ]),
  );

  return rows.map((row) => {
    const guild = guildById.get(row.guild_id);
    return {
      guild_id: row.guild_id,
      guild_name: guild?.name || null,
      guild_icon: guild?.icon || null,
      community_name: row.community_name,
      required_clan_name: row.required_clan_name,
      video_enabled: row.video_enabled,
      verified_role_name: row.verified_role_name,
      updated_at: row.updated_at,
    } satisfies StalcraftCommunityRow;
  });
}

export async function listVisibleStalcraftVideos(discordUserId: string) {
  const profile = await getStalcraftProfile(discordUserId);
  if (!profile?.selected_character_id) return [] as StalcraftVideoRow[];

  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("stalcraft_videos")
    .select("*")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw error;
  return (data || []) as StalcraftVideoRow[];
}
