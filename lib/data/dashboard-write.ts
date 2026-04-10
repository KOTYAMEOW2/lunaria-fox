import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { uniqueStrings } from "@/lib/utils";

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
      mod_roles: uniqueStrings(payload.modRoles),
      admin_roles: uniqueStrings(payload.adminRoles),
      enabled_modules: payload.enabledModules,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "guild_id" },
  );

  if (error) throw error;
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
        banned_words: uniqueStrings(payload.bannedWords),
        regex_rules: uniqueStrings(payload.regexRules),
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
}

export async function saveCommandSettings(
  guildId: string,
  payload: {
    commandPermissions: Array<{ command_name: string; enabled: boolean; cooldown: number; mode: string }>;
    customCommands: Array<{
      command_name: string;
      description: string;
      response_text: string;
      aliases: string[];
      enabled: boolean;
      cooldown: number;
    }>;
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
    mode: item.mode,
    updated_at: now,
  }));

  if (permissionsRows.length > 0) {
    const { error } = await supabase.from("command_permissions").upsert(permissionsRows, {
      onConflict: "guild_id,command_name",
    });
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
      trigger_type: "prefix",
      enabled: command.enabled,
      response_mode: "text",
      response_text: command.response_text,
      aliases: uniqueStrings(command.aliases),
      cooldown: command.cooldown,
      updated_at: now,
    }));

  if (customCommandRows.length > 0) {
    const { error } = await supabase.from("custom_commands").insert(customCommandRows);
    if (error) throw error;
  }
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
        support_roles: uniqueStrings(payload.supportRoles),
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
}
