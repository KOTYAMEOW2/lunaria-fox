import { getPremiumGuildSet } from "@/lib/env";
import { canManageGuild, fetchDiscordGuilds } from "@/lib/auth/discord";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type {
  BotAnalyticsEventRow,
  BrandRoleRow,
  AdminManagedGuild,
  BotGuildRow,
  CommandGroupRow,
  CommandPermissionRow,
  CommandRegistryRow,
  CustomCommandRow,
  DiscordSession,
  DashboardSyncStateRow,
  GuildChannelRow,
  GuildConfigRow,
  GuildDashboardData,
  GuildLogEntryRow,
  GuildLogSettingRow,
  GuildPremiumSettingsRow,
  GuildRoleRow,
  GuildRuleRow,
  ManagedGuild,
  PremiumAnalyticsSummary,
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

function emptyPremiumAnalytics(): PremiumAnalyticsSummary {
  return {
    totalEvents: 0,
    commandCount: 0,
    memberJoinCount: 0,
    memberLeaveCount: 0,
    topCommands: [],
    recentEventTypes: [],
  };
}

function buildPremiumAnalytics(rows: Array<{ event_type: string | null; payload: { command_name?: string } | null }>) {
  const eventCounts = new Map<string, number>();
  const commandCounts = new Map<string, number>();

  for (const row of rows) {
    const eventType = String(row.event_type || "event");
    eventCounts.set(eventType, (eventCounts.get(eventType) || 0) + 1);

    if (eventType === "command") {
      const command = String(row.payload?.command_name || "unknown");
      commandCounts.set(command, (commandCounts.get(command) || 0) + 1);
    }
  }

  return {
    totalEvents: rows.length,
    commandCount: eventCounts.get("command") || 0,
    memberJoinCount: eventCounts.get("member_join") || 0,
    memberLeaveCount: eventCounts.get("member_leave") || 0,
    topCommands: [...commandCounts.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 6)
      .map(([command, count]) => ({ command, count })),
    recentEventTypes: [...eventCounts.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 6)
      .map(([eventType, count]) => ({ eventType, count })),
  } satisfies PremiumAnalyticsSummary;
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

export async function getAdminManagedGuilds(): Promise<AdminManagedGuild[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  const [guildsResult, premiumResult, syncResult] = await Promise.all([
    supabase
      .from("bot_guilds")
      .select("guild_id, name, icon, owner_id, member_count, preferred_locale, is_available, updated_at")
      .order("name"),
    supabase
      .from("guild_premium_settings")
      .select("guild_id, premium_active, plan_name, features"),
    supabase
      .from("dashboard_sync_states")
      .select("guild_id, revision, bot_applied_revision, status, last_error, bot_seen_at, bot_applied_at"),
  ]);

  const premiumByGuild = new Map(
    (
      (premiumResult.data || []) as Array<{
        guild_id: string;
        premium_active: boolean | null;
        plan_name: string | null;
        features: string[] | null;
      }>
    ).map((row) => [row.guild_id, row]),
  );
  const syncByGuild = new Map(
    ((syncResult.data || []) as DashboardSyncStateRow[]).map((row) => [row.guild_id, row]),
  );

  return ((guildsResult.data || []) as BotGuildRow[])
    .map((guild) => {
      const premium = premiumByGuild.get(guild.guild_id);
      const sync = syncByGuild.get(guild.guild_id);

      return {
        id: guild.guild_id,
        name: guild.name || guild.guild_id,
        icon: guild.icon || null,
        ownerId: guild.owner_id || null,
        memberCount: guild.member_count || 0,
        preferredLocale: guild.preferred_locale || "ru",
        isAvailable: guild.is_available !== false,
        premiumActive: premium?.premium_active === true,
        premiumPlan: premium?.plan_name || null,
        premiumFeatures: Array.isArray(premium?.features) ? premium.features : [],
        syncRevision: Number(sync?.revision || 0),
        appliedRevision: Number(sync?.bot_applied_revision || 0),
        syncStatus: sync?.status || null,
        syncError: sync?.last_error || null,
        botSeenAt: sync?.bot_seen_at || null,
        botAppliedAt: sync?.bot_applied_at || null,
        updatedAt: guild.updated_at || null,
      } satisfies AdminManagedGuild;
    })
    .sort((left, right) => left.name.localeCompare(right.name, "ru"));
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

export async function getGuildSyncState(guildId: string) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null as DashboardSyncStateRow | null;

  const { data, error } = await supabase
    .from("dashboard_sync_states")
    .select("*")
    .eq("guild_id", guildId)
    .maybeSingle();

  if (error) return null;
  return (data as DashboardSyncStateRow | null) || null;
}

export async function getGuildDashboardData(guildId: string): Promise<GuildDashboardData> {
  const supabase = getSupabaseAdmin();
  const premiumFallback = getPremiumGuildSet().has(guildId);

  if (!supabase) {
    return {
      guild: null,
      config: null,
      customizations: null,
      serverPanel: null,
      brandRole: null,
      roles: [],
      channels: [],
      commandsRegistry: [],
      commandGroups: [],
      commandPermissions: [],
      customCommands: [],
      smartFilter: null,
      guildRules: [],
      logSettings: [],
      recentLogEntries: [],
      ticketConfig: null,
      ticketPanels: [],
      recentTickets: [],
      voicemasterConfig: null,
      voicemasterRooms: [],
      premiumSettings: null,
      premiumAnalytics: emptyPremiumAnalytics(),
      recentAnalyticsEvents: [],
      premiumEnabled: premiumFallback,
      syncState: null,
    };
  }

  const [
    guild,
    config,
    customizations,
    serverPanel,
    brandRole,
    roles,
    channels,
    commandsRegistry,
    commandGroups,
    commandPermissions,
    customCommands,
    smartFilter,
    guildRules,
    logSettings,
    recentLogEntries,
    ticketConfig,
    ticketPanels,
    recentTickets,
    voicemasterConfig,
    voicemasterRooms,
    premiumSettings,
    analyticsEvents,
    syncState,
  ] = await Promise.all([
    supabase.from("bot_guilds").select("*").eq("guild_id", guildId).maybeSingle(),
    supabase.from("guild_configs").select("*").eq("guild_id", guildId).maybeSingle(),
    supabase.from("server_customizations").select("*").eq("guild_id", guildId).maybeSingle(),
    supabase.from("server_panels").select("*").eq("guild_id", guildId).maybeSingle(),
    supabase.from("brand_roles").select("*").eq("guild_id", guildId).maybeSingle(),
    supabase.from("guild_roles").select("*").eq("guild_id", guildId).order("position", { ascending: false }),
    supabase.from("guild_channels").select("*").eq("guild_id", guildId).order("position"),
    supabase.from("commands_registry").select("*").order("category").order("command_name"),
    supabase.from("command_groups").select("*").eq("guild_id", guildId).order("sort_order"),
    supabase.from("command_permissions").select("*").eq("guild_id", guildId).order("command_name"),
    supabase.from("custom_commands").select("*").eq("guild_id", guildId).order("command_name"),
    supabase.from("smartfilter_configs").select("*").eq("guild_id", guildId).maybeSingle(),
    supabase.from("guild_rules").select("*").eq("guild_id", guildId).order("rule_order"),
    supabase.from("guild_log_settings").select("*").eq("guild_id", guildId).order("log_type"),
    supabase
      .from("guild_log_entries")
      .select("*")
      .eq("guild_id", guildId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase.from("ticket_configs").select("*").eq("guild_id", guildId).maybeSingle(),
    supabase.from("ticket_panels").select("*").eq("guild_id", guildId).order("panel_key"),
    supabase.from("tickets").select("*").eq("guild_id", guildId).order("updated_at", { ascending: false }).limit(8),
    supabase.from("voicemaster_configs").select("*").eq("guild_id", guildId).maybeSingle(),
    supabase.from("voicemaster_rooms").select("*").eq("guild_id", guildId).order("updated_at", { ascending: false }),
    supabase.from("guild_premium_settings").select("*").eq("guild_id", guildId).maybeSingle(),
    supabase
      .from("bot_analytics")
      .select("id, guild_id, event_type, payload, created_at")
      .eq("guild_id", guildId)
      .order("created_at", { ascending: false })
      .limit(500),
    supabase.from("dashboard_sync_states").select("*").eq("guild_id", guildId).maybeSingle(),
  ]);

  const premiumSettingsRow =
    premiumSettings.error || !premiumSettings.data
      ? null
      : (premiumSettings.data as GuildPremiumSettingsRow | null);
  const premiumEnabled = premiumSettingsRow?.premium_active ?? premiumFallback;

  return {
    guild: (guild.data as BotGuildRow | null) || null,
    config: (config.data as GuildConfigRow | null) || null,
    customizations: (customizations.data as ServerCustomizationRow | null) || null,
    serverPanel: (serverPanel.data as ServerPanelRow | null) || null,
    brandRole: (brandRole.data as BrandRoleRow | null) || null,
    roles: sortByName((roles.data || []) as GuildRoleRow[]),
    channels: sortByName((channels.data || []) as GuildChannelRow[]),
    commandsRegistry: (commandsRegistry.data || []) as CommandRegistryRow[],
    commandGroups: (commandGroups.data || []) as CommandGroupRow[],
    commandPermissions: (commandPermissions.data || []) as CommandPermissionRow[],
    customCommands: (customCommands.data || []) as CustomCommandRow[],
    smartFilter: (smartFilter.data as SmartFilterRow | null) || null,
    guildRules: (guildRules.data || []) as GuildRuleRow[],
    logSettings: (logSettings.data || []) as GuildLogSettingRow[],
    recentLogEntries: (recentLogEntries.data || []) as GuildLogEntryRow[],
    ticketConfig: (ticketConfig.data as TicketConfigRow | null) || null,
    ticketPanels: (ticketPanels.data || []) as TicketPanelRow[],
    recentTickets: (recentTickets.data || []) as TicketRow[],
    voicemasterConfig: (voicemasterConfig.data as VoicemasterConfigRow | null) || null,
    voicemasterRooms: (voicemasterRooms.data || []) as VoicemasterRoomRow[],
    premiumSettings: premiumSettingsRow,
    premiumAnalytics: analyticsEvents.error
      ? emptyPremiumAnalytics()
      : buildPremiumAnalytics(
          ((analyticsEvents.data || []) as Array<{ event_type: string | null; payload: { command_name?: string } | null }>),
        ),
    recentAnalyticsEvents: (analyticsEvents.data || []) as BotAnalyticsEventRow[],
    premiumEnabled,
    syncState:
      syncState.error || !syncState.data ? null : (syncState.data as DashboardSyncStateRow | null),
  };
}
