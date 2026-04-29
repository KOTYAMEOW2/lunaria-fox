import { getPremiumGuildSet } from "@/lib/env";
import { canManageGuild, fetchDiscordGuilds } from "@/lib/auth/discord";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type {
  AdminManagedGuild,
  BotGuildRow,
  BrandRoleRow,
  CommandPermissionRow,
  CommandRegistryRow,
  DashboardSyncStateRow,
  DiscordSession,
  GuildChannelRow,
  GuildConfigRow,
  GuildDashboardData,
  GuildLogSettingRow,
  GuildPremiumSettingsRow,
  GuildRoleRow,
  ManagedGuild,
  PremiumAnalyticsSummary,
  ServerCustomizationRow,
  SmartFilterRow,
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
    .select("command_name, category, description, command_type, supports_args, is_active, is_public, updated_at")
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
    .select("guild_id, revision, requested_at, requested_by, requested_source, last_section, changed_keys, site_updated_at, bot_seen_at, bot_applied_at, bot_applied_revision, status, last_error, meta")
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
    brandRole,
    roles,
    channels,
    commandsRegistry,
    commandPermissions,
    smartFilter,
    logSettings,
    voicemasterConfig,
    voicemasterRooms,
    premiumSettings,
    syncState,
  ] = await Promise.all([
    supabase
      .from("bot_guilds")
      .select("guild_id, name, icon, owner_id, member_count, preferred_locale, is_available, updated_at")
      .eq("guild_id", guildId)
      .maybeSingle(),
    supabase
      .from("guild_configs")
      .select("guild_id, prefix, language, enabled_modules, disabled_commands, mod_roles, admin_roles, appeals_channel_id, dm_punish_enabled, updated_at")
      .eq("guild_id", guildId)
      .maybeSingle(),
    supabase
      .from("server_customizations")
      .select("guild_id, embed_color, footer_text, footer_icon_url, webhook_name, webhook_avatar_url, banner_url, updated_at")
      .eq("guild_id", guildId)
      .maybeSingle(),
    supabase
      .from("brand_roles")
      .select("guild_id, role_id, role_name, color, hoist, mentionable, updated_at")
      .eq("guild_id", guildId)
      .maybeSingle(),
    supabase
      .from("guild_roles")
      .select("guild_id, role_id, name, color, position, permissions, managed, mentionable, hoist, updated_at")
      .eq("guild_id", guildId)
      .order("position", { ascending: false }),
    supabase
      .from("guild_channels")
      .select("guild_id, channel_id, name, type, parent_id, position, nsfw, topic, updated_at")
      .eq("guild_id", guildId)
      .order("position"),
    supabase
      .from("commands_registry")
      .select("command_name, category, description, command_type, supports_args, is_active, is_public, updated_at")
      .eq("is_active", true)
      .order("category")
      .order("command_name"),
    supabase
      .from("command_permissions")
      .select("guild_id, command_name, enabled, mode, cooldown, allow_roles, deny_roles, allow_users, deny_users, allow_groups, deny_groups, allow_channels, deny_channels, updated_at")
      .eq("guild_id", guildId)
      .order("command_name"),
    supabase
      .from("smartfilter_configs")
      .select("guild_id, enabled, banned_words, regex_rules, action, updated_at")
      .eq("guild_id", guildId)
      .maybeSingle(),
    supabase
      .from("guild_log_settings")
      .select("guild_id, log_type, enabled, channel_id, mention_roles, embed_color, updated_at")
      .eq("guild_id", guildId)
      .order("log_type"),
    supabase
      .from("voicemaster_configs")
      .select("guild_id, enabled, creator_channel_id, category_id, log_channel_id, room_name_template, default_user_limit, default_bitrate, allow_owner_rename, allow_owner_limit, allow_owner_lock, allow_owner_hide, updated_at, hubs")
      .eq("guild_id", guildId)
      .maybeSingle(),
    supabase
      .from("voicemaster_rooms")
      .select("channel_id, guild_id, owner_id, name, user_limit, bitrate, member_count, locked, hidden, created_at, updated_at, hub_id, allow_users, deny_users, panel_channel_id, panel_message_id, console_thread_id")
      .eq("guild_id", guildId)
      .order("updated_at", { ascending: false })
      .limit(25),
    supabase
      .from("guild_premium_settings")
      .select("guild_id, premium_active, plan_name, features, welcome_settings, server_panel_settings, analytics_settings, updated_at")
      .eq("guild_id", guildId)
      .maybeSingle(),
    supabase
      .from("dashboard_sync_states")
      .select("guild_id, revision, requested_at, requested_by, requested_source, last_section, changed_keys, site_updated_at, bot_seen_at, bot_applied_at, bot_applied_revision, status, last_error, meta")
      .eq("guild_id", guildId)
      .maybeSingle(),
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
    serverPanel: null,
    brandRole: (brandRole.data as BrandRoleRow | null) || null,
    roles: sortByName((roles.data || []) as GuildRoleRow[]),
    channels: sortByName((channels.data || []) as GuildChannelRow[]),
    commandsRegistry: (commandsRegistry.data || []) as CommandRegistryRow[],
    commandGroups: [],
    commandPermissions: (commandPermissions.data || []) as CommandPermissionRow[],
    customCommands: [],
    smartFilter: (smartFilter.data as SmartFilterRow | null) || null,
    guildRules: [],
    logSettings: (logSettings.data || []) as GuildLogSettingRow[],
    recentLogEntries: [],
    ticketConfig: null,
    ticketPanels: [],
    recentTickets: [],
    voicemasterConfig: (voicemasterConfig.data as VoicemasterConfigRow | null) || null,
    voicemasterRooms: (voicemasterRooms.data || []) as VoicemasterRoomRow[],
    premiumSettings: premiumSettingsRow,
    premiumAnalytics: emptyPremiumAnalytics(),
    recentAnalyticsEvents: [],
    premiumEnabled,
    syncState:
      syncState.error || !syncState.data ? null : (syncState.data as DashboardSyncStateRow | null),
  };
}
