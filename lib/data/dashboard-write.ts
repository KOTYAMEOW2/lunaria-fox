import type { DashboardSyncStateRow } from "@/lib/types";
import { getPremiumGuildSet } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { uniqueStrings } from "@/lib/utils";

type SyncOptions = {
  section: string;
  requestedBy?: string | null;
  changedKeys?: string[];
  meta?: Record<string, unknown>;
};

type CommandPermissionPayload = {
  command_name: string;
  enabled: boolean;
  cooldown: number;
  mode: string;
  allow_roles?: string[];
  deny_roles?: string[];
  allow_users?: string[];
  deny_users?: string[];
  allow_groups?: string[];
  deny_groups?: string[];
  allow_channels?: string[];
  deny_channels?: string[];
};

type PremiumSettingsPayload = {
  premiumActive: boolean;
  planName: string;
  features: string[];
  brandRole: {
    role_name: string;
    color: string;
    hoist: boolean;
    mentionable: boolean;
  };
  serverPanelSettings: Record<string, unknown>;
  welcomeSettings: Record<string, unknown>;
  analyticsSettings: Record<string, unknown>;
};

type AdminPremiumSettingsPayload = {
  premiumActive: boolean;
  planName: string;
  features: string[];
};

function asErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown sync error.";
}

function dedupeStrings(input: string[] | undefined) {
  return uniqueStrings(input || []);
}

function liteModules(input: Record<string, boolean> | null | undefined) {
  return {
    ...(input || {}),
    tickets: false,
    serverpanel: false,
    smartfilter: false,
    lunarialog: input?.lunarialog ?? true,
    voicemaster: input?.voicemaster ?? true,
    moderation: input?.moderation ?? true,
  };
}

async function assertPremiumAccess(guildId: string) {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase is not configured.");

  if (getPremiumGuildSet().has(guildId)) return;

  const { data, error } = await supabase
    .from("guild_premium_settings")
    .select("premium_active")
    .eq("guild_id", guildId)
    .maybeSingle();

  if (error) throw error;
  if (data?.premium_active === true) return;

  throw new Error("Premium required");
}

async function queueGuildSync(guildId: string, options: SyncOptions) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null as DashboardSyncStateRow | null;

  const now = new Date().toISOString();
  const current = await supabase
    .from("dashboard_sync_states")
    .select("*")
    .eq("guild_id", guildId)
    .maybeSingle();

  if (current.error) {
    console.warn("[dashboard-sync] read failed:", current.error.message);
    return null;
  }

  const currentRow = (current.data || null) as DashboardSyncStateRow | null;
  const revision = Number(currentRow?.revision || 0) + 1;

  const { data, error } = await supabase
    .from("dashboard_sync_states")
    .upsert(
      {
        guild_id: guildId,
        revision,
        requested_at: now,
        requested_by: options.requestedBy || null,
        requested_source: "dashboard",
        last_section: options.section,
        changed_keys: dedupeStrings(options.changedKeys),
        site_updated_at: now,
        status: "queued",
        last_error: null,
        meta: options.meta || {},
      },
      { onConflict: "guild_id" },
    )
    .select("*")
    .single();

  if (error) {
    console.warn("[dashboard-sync] upsert failed:", error.message);
    return null;
  }

  return (data as DashboardSyncStateRow) || null;
}

export async function saveGuildOverview(
  guildId: string,
  payload: {
    prefix: string;
    language: string;
    appealsChannelId?: string | null;
    dmPunishEnabled: boolean;
    modRoles: string[];
    adminRoles: string[];
    enabledModules: Record<string, boolean>;
  },
) {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase is not configured.");

  const enabledModules = liteModules(payload.enabledModules);

  const { error } = await supabase.from("guild_configs").upsert(
    {
      guild_id: guildId,
      prefix: payload.prefix,
      language: payload.language,
      appeals_channel_id: null,
      dm_punish_enabled: payload.dmPunishEnabled,
      mod_roles: dedupeStrings(payload.modRoles),
      admin_roles: dedupeStrings(payload.adminRoles),
      enabled_modules: enabledModules,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "guild_id" },
  );

  if (error) throw error;

  return {
    syncState: await queueGuildSync(guildId, {
      section: "overview",
      changedKeys: ["prefix", "language", "dm_punish_enabled", "mod_roles", "admin_roles", "enabled_modules"],
      meta: {
        enabledModules: Object.keys(enabledModules),
        removedModules: ["tickets", "appeals", "serverpanel", "smartfilter", "custom_commands"],
      },
    }),
  };
}

export async function saveBrandingSettings(
  guildId: string,
  payload: {
    embedColor: string;
    footerText: string;
    footerIconUrl: string | null;
    webhookName: string;
    webhookAvatarUrl: string | null;
    bannerUrl: string | null;
    panelEnabled?: boolean;
    panelChannelId?: string | null;
  },
) {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase is not configured.");

  const { error } = await supabase.from("server_customizations").upsert(
    {
      guild_id: guildId,
      embed_color: payload.embedColor,
      footer_text: payload.footerText,
      footer_icon_url: payload.footerIconUrl || null,
      webhook_name: payload.webhookName,
      webhook_avatar_url: payload.webhookAvatarUrl || null,
      banner_url: payload.bannerUrl || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "guild_id" },
  );

  if (error) throw error;

  return {
    syncState: await queueGuildSync(guildId, {
      section: "branding",
      changedKeys: ["embed_color", "footer_text", "footer_icon_url", "webhook_name", "webhook_avatar_url", "banner_url"],
      meta: { serverPanelRemoved: true },
    }),
  };
}

export async function saveModerationSettings(
  guildId: string,
  payload: {
    smartFilterEnabled?: boolean;
    smartFilterAction?: string;
    bannedWords?: string[];
    regexRules?: string[];
    globalLogChannelId: string | null;
    globalLogColor: string | null;
    rules?: Array<{ title: string; content: string; enabled: boolean }>;
  },
) {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase is not configured.");

  const { error } = await supabase.from("guild_log_settings").upsert(
    {
      guild_id: guildId,
      log_type: "all",
      enabled: Boolean(payload.globalLogChannelId),
      channel_id: payload.globalLogChannelId,
      embed_color: payload.globalLogColor || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "guild_id,log_type" },
  );

  if (error) throw error;

  return {
    syncState: await queueGuildSync(guildId, {
      section: "moderation",
      changedKeys: ["guild_log_settings"],
      meta: { smartFilterRemoved: true, rulesDashboardRemoved: true, logsStoredInDiscordOnly: true },
    }),
  };
}

export async function saveCommandSettings(
  guildId: string,
  payload: {
    commandPermissions: CommandPermissionPayload[];
    commandGroups?: unknown[];
    customCommands?: unknown[];
  },
) {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase is not configured.");

  const now = new Date().toISOString();
  const permissionsRows = payload.commandPermissions.map((item) => ({
    guild_id: guildId,
    command_name: item.command_name,
    enabled: item.enabled,
    cooldown: item.cooldown,
    mode: item.mode === "allowlist" ? "allowlist" : "inherit",
    allow_roles: dedupeStrings(item.allow_roles),
    deny_roles: dedupeStrings(item.deny_roles),
    allow_users: dedupeStrings(item.allow_users),
    deny_users: dedupeStrings(item.deny_users),
    allow_groups: dedupeStrings(item.allow_groups),
    deny_groups: dedupeStrings(item.deny_groups),
    allow_channels: dedupeStrings(item.allow_channels),
    deny_channels: dedupeStrings(item.deny_channels),
    updated_at: now,
  }));

  if (permissionsRows.length > 0) {
    const { error } = await supabase.from("command_permissions").upsert(permissionsRows, {
      onConflict: "guild_id,command_name",
    });
    if (error) throw error;
  }

  return {
    syncState: await queueGuildSync(guildId, {
      section: "commands",
      changedKeys: ["command_permissions"],
      meta: {
        permissionsCount: permissionsRows.length,
        commandGroupsIgnored: true,
        customCommandsRemoved: true,
      },
    }),
  };
}

export async function savePremiumSettings(guildId: string, payload: PremiumSettingsPayload) {
  return savePremiumSettingsInternal(guildId, payload, { bypassPremiumAccess: false });
}

export async function saveAdminPremiumSettings(guildId: string, payload: AdminPremiumSettingsPayload) {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase is not configured.");

  const [premiumCurrent, brandRoleCurrent] = await Promise.all([
    supabase.from("guild_premium_settings").select("*").eq("guild_id", guildId).maybeSingle(),
    supabase.from("brand_roles").select("*").eq("guild_id", guildId).maybeSingle(),
  ]);

  if (premiumCurrent.error) throw premiumCurrent.error;
  if (brandRoleCurrent.error) throw brandRoleCurrent.error;

  const premiumData =
    premiumCurrent.data && typeof premiumCurrent.data === "object"
      ? (premiumCurrent.data as Record<string, unknown>)
      : {};
  const brandRoleData =
    brandRoleCurrent.data && typeof brandRoleCurrent.data === "object"
      ? (brandRoleCurrent.data as Record<string, unknown>)
      : {};

  const mergedPayload: PremiumSettingsPayload = {
    premiumActive: payload.premiumActive,
    planName: payload.planName,
    features: payload.features,
    brandRole: {
      role_name: typeof brandRoleData.role_name === "string" && brandRoleData.role_name.trim() ? brandRoleData.role_name : "Lunaria Premium",
      color: typeof brandRoleData.color === "string" && brandRoleData.color.trim() ? brandRoleData.color : "#b784ff",
      hoist: brandRoleData.hoist === true,
      mentionable: brandRoleData.mentionable === true,
    },
    serverPanelSettings:
      premiumData.server_panel_settings && typeof premiumData.server_panel_settings === "object"
        ? (premiumData.server_panel_settings as Record<string, unknown>)
        : {},
    welcomeSettings:
      premiumData.welcome_settings && typeof premiumData.welcome_settings === "object"
        ? (premiumData.welcome_settings as Record<string, unknown>)
        : {},
    analyticsSettings:
      premiumData.analytics_settings && typeof premiumData.analytics_settings === "object"
        ? (premiumData.analytics_settings as Record<string, unknown>)
        : {},
  };

  return savePremiumSettingsInternal(guildId, mergedPayload, { bypassPremiumAccess: true });
}

async function savePremiumSettingsInternal(
  guildId: string,
  payload: PremiumSettingsPayload,
  options: { bypassPremiumAccess: boolean },
) {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase is not configured.");
  if (!options.bypassPremiumAccess) {
    await assertPremiumAccess(guildId);
  }

  const now = new Date().toISOString();

  const [{ error: premiumError }, { error: brandRoleError }] = await Promise.all([
    supabase.from("guild_premium_settings").upsert(
      {
        guild_id: guildId,
        premium_active: payload.premiumActive,
        plan_name: payload.planName || "premium",
        features: dedupeStrings(payload.features),
        server_panel_settings: payload.serverPanelSettings,
        welcome_settings: payload.welcomeSettings,
        analytics_settings: payload.analyticsSettings,
        updated_at: now,
      },
      { onConflict: "guild_id" },
    ),
    supabase.from("brand_roles").upsert(
      {
        guild_id: guildId,
        role_name: payload.brandRole.role_name,
        color: payload.brandRole.color,
        hoist: payload.brandRole.hoist,
        mentionable: payload.brandRole.mentionable,
        updated_at: now,
      },
      { onConflict: "guild_id" },
    ),
  ]);

  if (premiumError) throw premiumError;
  if (brandRoleError) throw brandRoleError;

  return {
    syncState: await queueGuildSync(guildId, {
      section: "premium",
      changedKeys: ["guild_premium_settings", "brand_roles"],
      meta: { features: dedupeStrings(payload.features) },
    }),
  };
}

export async function saveTicketSettings() {
  throw new Error("Tickets module is disabled in Lunaria Lite.");
}

export async function saveVoicemasterSettings(
  guildId: string,
  payload: {
    enabled: boolean;
    creatorChannelId: string | null;
    categoryId: string | null;
    logChannelId: string | null;
    roomNameTemplate: string;
    defaultUserLimit: number;
    defaultBitrate: number;
    allowOwnerRename: boolean;
    allowOwnerLimit: boolean;
    allowOwnerLock: boolean;
    allowOwnerHide: boolean;
    hubs: Record<string, unknown>;
  },
) {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase is not configured.");

  const { error } = await supabase.from("voicemaster_configs").upsert(
    {
      guild_id: guildId,
      enabled: payload.enabled,
      creator_channel_id: payload.creatorChannelId,
      category_id: payload.categoryId,
      log_channel_id: payload.logChannelId,
      room_name_template: payload.roomNameTemplate,
      default_user_limit: payload.defaultUserLimit,
      default_bitrate: payload.defaultBitrate,
      allow_owner_rename: payload.allowOwnerRename,
      allow_owner_limit: payload.allowOwnerLimit,
      allow_owner_lock: payload.allowOwnerLock,
      allow_owner_hide: payload.allowOwnerHide,
      hubs: payload.hubs,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "guild_id" },
  );

  if (error) throw error;

  return {
    syncState: await queueGuildSync(guildId, {
      section: "voice",
      changedKeys: ["voicemaster_configs"],
      meta: { hubCount: Object.keys(payload.hubs || {}).length },
    }),
  };
}

export async function markGuildSyncError(guildId: string, error: unknown) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  await supabase.from("dashboard_sync_states").upsert(
    {
      guild_id: guildId,
      status: "error",
      last_error: asErrorMessage(error),
      site_updated_at: new Date().toISOString(),
    },
    { onConflict: "guild_id" },
  );
}
