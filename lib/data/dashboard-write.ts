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

type CommandGroupPayload = {
  group_id: string;
  name: string;
  roles: string[];
  scopes: string[];
  color?: string | null;
  is_default?: boolean;
};

type CustomCommandPayload = {
  command_name: string;
  description: string;
  trigger_type: string;
  response_mode: string;
  response_text: string;
  embed?: Record<string, unknown> | null;
  actions?: Array<Record<string, unknown>>;
  aliases: string[];
  enabled: boolean;
  cooldown: number;
  allowed_roles?: string[];
  denied_roles?: string[];
  allowed_channels?: string[];
  denied_channels?: string[];
  meta?: Record<string, unknown>;
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
    appealsChannelId: string | null;
    dmPunishEnabled: boolean;
    modRoles: string[];
    adminRoles: string[];
    enabledModules: Record<string, boolean>;
  },
) {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase is not configured.");

  const { error } = await supabase.from("guild_configs").upsert(
    {
      guild_id: guildId,
      prefix: payload.prefix,
      language: payload.language,
      appeals_channel_id: payload.appealsChannelId,
      dm_punish_enabled: payload.dmPunishEnabled,
      mod_roles: dedupeStrings(payload.modRoles),
      admin_roles: dedupeStrings(payload.adminRoles),
      enabled_modules: payload.enabledModules,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "guild_id" },
  );

  if (error) throw error;

  return {
    syncState: await queueGuildSync(guildId, {
      section: "overview",
      changedKeys: ["prefix", "language", "appeals_channel_id", "dm_punish_enabled", "mod_roles", "admin_roles", "enabled_modules"],
      meta: { enabledModules: Object.keys(payload.enabledModules) },
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
    panelEnabled: boolean;
    panelChannelId: string | null;
  },
) {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase is not configured.");

  const now = new Date().toISOString();

  const [{ error: customizationError }, { error: panelError }] = await Promise.all([
    supabase.from("server_customizations").upsert(
      {
        guild_id: guildId,
        embed_color: payload.embedColor,
        footer_text: payload.footerText,
        footer_icon_url: payload.footerIconUrl || null,
        webhook_name: payload.webhookName,
        webhook_avatar_url: payload.webhookAvatarUrl || null,
        banner_url: payload.bannerUrl || null,
        updated_at: now,
      },
      { onConflict: "guild_id" },
    ),
    supabase.from("server_panels").upsert(
      {
        guild_id: guildId,
        enabled: payload.panelEnabled,
        channel_id: payload.panelChannelId,
        updated_at: now,
      },
      { onConflict: "guild_id" },
    ),
  ]);

  if (customizationError) throw customizationError;
  if (panelError) throw panelError;

  return {
    syncState: await queueGuildSync(guildId, {
      section: "branding",
      changedKeys: [
        "embed_color",
        "footer_text",
        "footer_icon_url",
        "webhook_name",
        "webhook_avatar_url",
        "banner_url",
        "server_panel.enabled",
        "server_panel.channel_id",
      ],
    }),
  };
}

export async function saveModerationSettings(
  guildId: string,
  payload: {
    smartFilterEnabled: boolean;
    smartFilterAction: string;
    bannedWords: string[];
    regexRules: string[];
    globalLogChannelId: string | null;
    globalLogColor: string | null;
    rules: Array<{ title: string; content: string; enabled: boolean }>;
  },
) {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase is not configured.");

  const now = new Date().toISOString();

  const [{ error: smartFilterError }, { error: logError }] = await Promise.all([
    supabase.from("smartfilter_configs").upsert(
      {
        guild_id: guildId,
        enabled: payload.smartFilterEnabled,
        action: payload.smartFilterAction,
        banned_words: dedupeStrings(payload.bannedWords),
        regex_rules: dedupeStrings(payload.regexRules),
        updated_at: now,
      },
      { onConflict: "guild_id" },
    ),
    supabase.from("guild_log_settings").upsert(
      {
        guild_id: guildId,
        log_type: "all",
        enabled: Boolean(payload.globalLogChannelId),
        channel_id: payload.globalLogChannelId,
        embed_color: payload.globalLogColor || null,
        updated_at: now,
      },
      { onConflict: "guild_id,log_type" },
    ),
  ]);

  if (smartFilterError) throw smartFilterError;
  if (logError) throw logError;

  const { error: deleteRulesError } = await supabase.from("guild_rules").delete().eq("guild_id", guildId);
  if (deleteRulesError) throw deleteRulesError;

  const rows = payload.rules
    .map((rule, index) => ({
      guild_id: guildId,
      rule_order: index + 1,
      title: rule.title,
      content: rule.content,
      enabled: rule.enabled,
      updated_at: now,
    }))
    .filter((rule) => rule.title || rule.content);

  if (rows.length > 0) {
    const { error } = await supabase.from("guild_rules").insert(rows);
    if (error) throw error;
  }

  return {
    syncState: await queueGuildSync(guildId, {
      section: "moderation",
      changedKeys: ["smartfilter_configs", "guild_log_settings", "guild_rules"],
      meta: { rulesCount: rows.length },
    }),
  };
}

export async function saveCommandSettings(
  guildId: string,
  payload: {
    commandPermissions: CommandPermissionPayload[];
    commandGroups: CommandGroupPayload[];
    customCommands: CustomCommandPayload[];
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

  const { error: deleteGroupsError } = await supabase.from("command_groups").delete().eq("guild_id", guildId);
  if (deleteGroupsError) throw deleteGroupsError;

  const groupRows = payload.commandGroups
    .filter((group) => group.group_id)
    .map((group, index) => ({
      guild_id: guildId,
      group_id: group.group_id.toLowerCase(),
      name: group.name,
      roles: dedupeStrings(group.roles),
      scopes: dedupeStrings(group.scopes),
      sort_order: index + 1,
      color: group.color || null,
      is_default: group.is_default === true,
      updated_at: now,
    }));

  if (groupRows.length > 0) {
    const { error } = await supabase.from("command_groups").insert(groupRows);
    if (error) throw error;
  }

  const { error: deleteCustomCommandsError } = await supabase.from("custom_commands").delete().eq("guild_id", guildId);
  if (deleteCustomCommandsError) throw deleteCustomCommandsError;

  const customCommandRows = payload.customCommands
    .filter((command) => command.command_name)
    .map((command) => ({
      guild_id: guildId,
      command_name: command.command_name.toLowerCase(),
      description: command.description,
      trigger_type: command.trigger_type === "prefix" ? "prefix" : "prefix",
      enabled: command.enabled,
      response_mode: command.response_mode === "embed" ? "embed" : "text",
      response_text: command.response_text,
      embed: command.embed && typeof command.embed === "object" ? command.embed : {},
      actions: Array.isArray(command.actions) ? command.actions : [],
      aliases: dedupeStrings(command.aliases),
      cooldown: command.cooldown,
      allowed_roles: dedupeStrings(command.allowed_roles),
      denied_roles: dedupeStrings(command.denied_roles),
      allowed_channels: dedupeStrings(command.allowed_channels),
      denied_channels: dedupeStrings(command.denied_channels),
      meta: command.meta && typeof command.meta === "object" ? command.meta : {},
      updated_at: now,
    }));

  if (customCommandRows.length > 0) {
    const { error } = await supabase.from("custom_commands").insert(customCommandRows);
    if (error) throw error;
  }

  return {
    syncState: await queueGuildSync(guildId, {
      section: "commands",
      changedKeys: ["command_permissions", "command_groups", "custom_commands"],
      meta: {
        permissionsCount: permissionsRows.length,
        groupsCount: groupRows.length,
        customCommandsCount: customCommandRows.length,
      },
    }),
  };
}

export async function savePremiumSettings(
  guildId: string,
  payload: PremiumSettingsPayload,
) {
  return savePremiumSettingsInternal(guildId, payload, { bypassPremiumAccess: false });
}

export async function saveAdminPremiumSettings(
  guildId: string,
  payload: AdminPremiumSettingsPayload,
) {
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

export async function saveTicketSettings(
  guildId: string,
  payload: {
    enabled: boolean;
    defaultCategoryId: string | null;
    defaultLogChannelId: string | null;
    transcriptChannelId: string | null;
    supportRoles: string[];
    maxOpenPerUser: number;
    panels: Array<{
      panel_key: string;
      panel_name: string;
      panel_channel_id: string | null;
      title: string;
      description: string;
      button_label: string;
      button_style: string;
      emoji: string;
      category_id: string | null;
      log_channel_id: string | null;
      ticket_name_template: string;
      enabled: boolean;
    }>;
  },
) {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase is not configured.");

  const now = new Date().toISOString();

  const [{ error: configError }, { error: deletePanelsError }] = await Promise.all([
    supabase.from("ticket_configs").upsert(
      {
        guild_id: guildId,
        enabled: payload.enabled,
        default_category_id: payload.defaultCategoryId,
        default_log_channel_id: payload.defaultLogChannelId,
        transcript_channel_id: payload.transcriptChannelId,
        support_roles: dedupeStrings(payload.supportRoles),
        max_open_per_user: payload.maxOpenPerUser,
        updated_at: now,
      },
      { onConflict: "guild_id" },
    ),
    supabase.from("ticket_panels").delete().eq("guild_id", guildId),
  ]);

  if (configError) throw configError;
  if (deletePanelsError) throw deletePanelsError;

  const panels = payload.panels
    .filter((panel) => panel.panel_key)
    .map((panel) => ({
      guild_id: guildId,
      panel_key: panel.panel_key,
      panel_name: panel.panel_name,
      panel_channel_id: panel.panel_channel_id,
      title: panel.title,
      description: panel.description,
      button_label: panel.button_label,
      button_style: panel.button_style,
      emoji: panel.emoji,
      category_id: panel.category_id,
      log_channel_id: panel.log_channel_id,
      ticket_name_template: panel.ticket_name_template,
      max_open_per_user: payload.maxOpenPerUser,
      enabled: panel.enabled,
      updated_at: now,
    }));

  if (panels.length > 0) {
    const { error } = await supabase.from("ticket_panels").insert(panels);
    if (error) throw error;
  }

  return {
    syncState: await queueGuildSync(guildId, {
      section: "tickets",
      changedKeys: ["ticket_configs", "ticket_panels"],
      meta: { panelsCount: panels.length },
    }),
  };
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
