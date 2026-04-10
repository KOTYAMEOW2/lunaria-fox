import { getPremiumGuildSet } from "@/lib/env";
import { canManageGuild, fetchDiscordGuilds } from "@/lib/auth/discord";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type {
  BotGuildRow,
  CommandGroupRow,
  CommandPermissionRow,
  CommandRegistryRow,
  CustomCommandRow,
  DiscordSession,
  GuildChannelRow,
  GuildConfigRow,
  GuildDashboardData,
  GuildLogSettingRow,
  GuildRoleRow,
  GuildRuleRow,
  ManagedGuild,
  ServerCustomizationRow,
  ServerPanelRow,
  SmartFilterRow,
  TicketConfigRow,
  TicketPanelRow,
  TicketRow,
  VoicemasterConfigRow,
  VoicemasterRoomRow,
} from "@/lib/types";

function sortByName<T extends { name: string | null }>(rows: T[]) {
  return [...rows].sort((left, right) =>
    String(left.name || "").localeCompare(String(right.name || ""), "ru"),
  );
}

export async function getManagedGuilds(session: DiscordSession | null): Promise<ManagedGuild[]> {
  if (!session) return [];

  const discordGuilds = (await fetchDiscordGuilds(session.accessToken)).filter(canManageGuild);
  const supabase = getSupabaseAdmin();

  if (!supabase || discordGuilds.length === 0) {
    return discordGuilds.map((guild) => ({
      ...guild,
      installed: false,
      memberCount: 0,
      preferredLocale: "ru",
      isAvailable: false,
      ownerId: null,
    }));
  }

  const guildIds = discordGuilds.map((guild) => guild.id);
  const { data } = await supabase
    .from("bot_guilds")
    .select("guild_id, owner_id, member_count, preferred_locale, is_available")
    .in("guild_id", guildIds);

  const byId = new Map<string, BotGuildRow>(
    ((data || []) as BotGuildRow[]).map((row: BotGuildRow) => [row.guild_id, row]),
  );

  return discordGuilds.map((guild) => {
    const tracked = byId.get(guild.id);

    return {
      ...guild,
      installed: Boolean(tracked),
      memberCount: tracked?.member_count || 0,
      preferredLocale: tracked?.preferred_locale || "ru",
      isAvailable: tracked?.is_available !== false,
      ownerId: tracked?.owner_id || null,
    };
  });
}

export async function getPublicCommandDirectory() {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [] as CommandRegistryRow[];

  const { data } = await supabase
    .from("commands_registry")
    .select("*")
    .eq("is_public", true)
    .eq("is_active", true)
    .order("category")
    .order("command_name");

  return (data || []) as CommandRegistryRow[];
}

export async function getGuildDashboardData(guildId: string): Promise<GuildDashboardData> {
  const supabase = getSupabaseAdmin();
  const premiumEnabled = getPremiumGuildSet().has(guildId);

  if (!supabase) {
    return {
      guild: null,
      config: null,
      customizations: null,
      serverPanel: null,
      roles: [],
      channels: [],
      commandsRegistry: [],
      commandGroups: [],
      commandPermissions: [],
      customCommands: [],
      smartFilter: null,
      guildRules: [],
      logSettings: [],
      ticketConfig: null,
      ticketPanels: [],
      recentTickets: [],
      voicemasterConfig: null,
      voicemasterRooms: [],
      premiumEnabled,
    };
  }

  const [
    guild,
    config,
    customizations,
    serverPanel,
    roles,
    channels,
    commandsRegistry,
    commandGroups,
    commandPermissions,
    customCommands,
    smartFilter,
    guildRules,
    logSettings,
    ticketConfig,
    ticketPanels,
    recentTickets,
    voicemasterConfig,
    voicemasterRooms,
  ] = await Promise.all([
    supabase.from("bot_guilds").select("*").eq("guild_id", guildId).maybeSingle(),
    supabase.from("guild_configs").select("*").eq("guild_id", guildId).maybeSingle(),
    supabase.from("server_customizations").select("*").eq("guild_id", guildId).maybeSingle(),
    supabase.from("server_panels").select("*").eq("guild_id", guildId).maybeSingle(),
    supabase.from("guild_roles").select("*").eq("guild_id", guildId).order("position", { ascending: false }),
    supabase.from("guild_channels").select("*").eq("guild_id", guildId).order("position"),
    supabase.from("commands_registry").select("*").order("category").order("command_name"),
    supabase.from("command_groups").select("*").eq("guild_id", guildId).order("sort_order"),
    supabase.from("command_permissions").select("*").eq("guild_id", guildId).order("command_name"),
    supabase.from("custom_commands").select("*").eq("guild_id", guildId).order("command_name"),
    supabase.from("smartfilter_configs").select("*").eq("guild_id", guildId).maybeSingle(),
    supabase.from("guild_rules").select("*").eq("guild_id", guildId).order("rule_order"),
    supabase.from("guild_log_settings").select("*").eq("guild_id", guildId).order("log_type"),
    supabase.from("ticket_configs").select("*").eq("guild_id", guildId).maybeSingle(),
    supabase.from("ticket_panels").select("*").eq("guild_id", guildId).order("panel_key"),
    supabase.from("tickets").select("*").eq("guild_id", guildId).order("updated_at", { ascending: false }).limit(8),
    supabase.from("voicemaster_configs").select("*").eq("guild_id", guildId).maybeSingle(),
    supabase.from("voicemaster_rooms").select("*").eq("guild_id", guildId).order("updated_at", { ascending: false }),
  ]);

  return {
    guild: (guild.data as BotGuildRow | null) || null,
    config: (config.data as GuildConfigRow | null) || null,
    customizations: (customizations.data as ServerCustomizationRow | null) || null,
    serverPanel: (serverPanel.data as ServerPanelRow | null) || null,
    roles: sortByName((roles.data || []) as GuildRoleRow[]),
    channels: sortByName((channels.data || []) as GuildChannelRow[]),
    commandsRegistry: (commandsRegistry.data || []) as CommandRegistryRow[],
    commandGroups: (commandGroups.data || []) as CommandGroupRow[],
    commandPermissions: (commandPermissions.data || []) as CommandPermissionRow[],
    customCommands: (customCommands.data || []) as CustomCommandRow[],
    smartFilter: (smartFilter.data as SmartFilterRow | null) || null,
    guildRules: (guildRules.data || []) as GuildRuleRow[],
    logSettings: (logSettings.data || []) as GuildLogSettingRow[],
    ticketConfig: (ticketConfig.data as TicketConfigRow | null) || null,
    ticketPanels: (ticketPanels.data || []) as TicketPanelRow[],
    recentTickets: (recentTickets.data || []) as TicketRow[],
    voicemasterConfig: (voicemasterConfig.data as VoicemasterConfigRow | null) || null,
    voicemasterRooms: (voicemasterRooms.data || []) as VoicemasterRoomRow[],
    premiumEnabled,
  };
}
