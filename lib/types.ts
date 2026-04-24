export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json }
  | Json[];

export type DiscordSession = {
  userId: string;
  username: string;
  globalName: string | null;
  avatar: string | null;
  accessToken: string;
  expiresAt: number;
};

export type DiscordGuild = {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
};

export type ManagedGuild = DiscordGuild & {
  installed: boolean;
  memberCount: number;
  preferredLocale: string;
  isAvailable: boolean;
  ownerId: string | null;
};

export type AdminManagedGuild = {
  id: string;
  name: string;
  icon: string | null;
  ownerId: string | null;
  memberCount: number;
  preferredLocale: string;
  isAvailable: boolean;
  premiumActive: boolean;
  premiumPlan: string | null;
  premiumFeatures: string[];
  syncRevision: number;
  appliedRevision: number;
  syncStatus: string | null;
  syncError: string | null;
  botSeenAt: string | null;
  botAppliedAt: string | null;
  updatedAt: string | null;
};

export type BotGuildRow = {
  guild_id: string;
  name: string | null;
  icon: string | null;
  owner_id: string | null;
  member_count: number | null;
  preferred_locale: string | null;
  is_available: boolean | null;
  updated_at: string | null;
};

export type GuildConfigRow = {
  guild_id: string;
  prefix: string | null;
  language: string | null;
  enabled_modules: Record<string, boolean> | null;
  disabled_commands: string[] | null;
  mod_roles: string[] | null;
  admin_roles: string[] | null;
  appeals_channel_id: string | null;
  dm_punish_enabled: boolean | null;
  updated_at: string | null;
};

export type ServerCustomizationRow = {
  guild_id: string;
  embed_color: string | null;
  footer_text: string | null;
  footer_icon_url: string | null;
  webhook_name: string | null;
  webhook_avatar_url: string | null;
  banner_url: string | null;
  updated_at: string | null;
};

export type ServerPanelRow = {
  guild_id: string;
  enabled: boolean | null;
  channel_id: string | null;
  message_id: string | null;
  updated_at: string | null;
};

export type BrandRoleRow = {
  guild_id: string;
  role_id: string | null;
  role_name: string | null;
  color: string | null;
  hoist: boolean | null;
  mentionable: boolean | null;
  updated_at: string | null;
};

export type GuildPremiumSettingsRow = {
  guild_id: string;
  premium_active: boolean | null;
  plan_name: string | null;
  features: string[] | null;
  welcome_settings: Json | null;
  server_panel_settings: Json | null;
  analytics_settings: Json | null;
  updated_at: string | null;
};

export type PremiumAnalyticsSummary = {
  totalEvents: number;
  commandCount: number;
  memberJoinCount: number;
  memberLeaveCount: number;
  topCommands: Array<{ command: string; count: number }>;
  recentEventTypes: Array<{ eventType: string; count: number }>;
};

export type DashboardSyncStateRow = {
  guild_id: string;
  revision: number | null;
  requested_at: string | null;
  requested_by: string | null;
  requested_source: string | null;
  last_section: string | null;
  changed_keys: string[] | null;
  site_updated_at: string | null;
  bot_seen_at: string | null;
  bot_applied_at: string | null;
  bot_applied_revision: number | null;
  status: string | null;
  last_error: string | null;
  meta: Json | null;
};

export type GuildRoleRow = {
  guild_id: string;
  role_id: string;
  name: string;
  color: string | null;
  position: number | null;
  permissions: string | null;
  managed: boolean | null;
  mentionable: boolean | null;
  hoist: boolean | null;
  updated_at: string | null;
};

export type GuildChannelRow = {
  guild_id: string;
  channel_id: string;
  name: string;
  type: string;
  parent_id: string | null;
  position: number | null;
  nsfw: boolean | null;
  topic: string | null;
  updated_at: string | null;
};

export type CommandRegistryRow = {
  command_name: string;
  category: string | null;
  description: string | null;
  command_type: string | null;
  supports_args: boolean | null;
  is_active: boolean | null;
  is_public: boolean | null;
  updated_at: string | null;
};

export type CommandGroupRow = {
  guild_id: string;
  group_id: string;
  name: string | null;
  roles: string[] | null;
  scopes: string[] | null;
  updated_at: string | null;
  kind: string | null;
  sort_order: number | null;
  color: string | null;
  is_default: boolean | null;
  meta: Json | null;
};

export type CommandPermissionRow = {
  guild_id: string;
  command_name: string;
  enabled: boolean | null;
  mode: string | null;
  cooldown: number | null;
  allow_roles: string[] | null;
  deny_roles: string[] | null;
  allow_users: string[] | null;
  deny_users: string[] | null;
  allow_groups: string[] | null;
  deny_groups: string[] | null;
  allow_channels: string[] | null;
  deny_channels: string[] | null;
  updated_at: string | null;
};

export type CustomCommandRow = {
  id: number | null;
  guild_id: string;
  command_name: string;
  description: string | null;
  trigger_type: string | null;
  enabled: boolean | null;
  response_mode: string | null;
  response_text: string | null;
  embed: Json | null;
  actions: Json | null;
  aliases: string[] | null;
  cooldown: number | null;
  allowed_roles: string[] | null;
  denied_roles: string[] | null;
  allowed_channels: string[] | null;
  denied_channels: string[] | null;
  meta: Json | null;
  created_at: string | null;
  updated_at: string | null;
};

export type SmartFilterRow = {
  guild_id: string;
  enabled: boolean | null;
  banned_words: string[] | null;
  regex_rules: string[] | null;
  action: string | null;
  updated_at: string | null;
};

export type GuildRuleRow = {
  id: number;
  guild_id: string;
  rule_order: number | null;
  title: string | null;
  content: string | null;
  enabled: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};

export type GuildLogSettingRow = {
  guild_id: string;
  log_type: string;
  enabled: boolean | null;
  channel_id: string | null;
  mention_roles: string[] | null;
  embed_color: string | null;
  updated_at: string | null;
};

export type GuildLogEntryRow = {
  id: number | string | null;
  guild_id: string;
  log_type: string;
  user_id: string | null;
  target_id: string | null;
  moderator_id: string | null;
  message: string | null;
  meta: Json | null;
  created_at: string | null;
};

export type BotAnalyticsEventRow = {
  id: number | string | null;
  guild_id: string | null;
  event_type: string | null;
  payload: Json | null;
  created_at: string | null;
};

export type TicketConfigRow = {
  guild_id: string;
  enabled: boolean | null;
  default_category_id: string | null;
  default_log_channel_id: string | null;
  transcript_channel_id: string | null;
  support_roles: string[] | null;
  max_open_per_user: number | null;
  updated_at: string | null;
};

export type TicketPanelRow = {
  id: number | null;
  guild_id: string;
  panel_key: string;
  panel_name: string | null;
  panel_channel_id: string | null;
  panel_message_id: string | null;
  title: string | null;
  description: string | null;
  button_label: string | null;
  button_style: string | null;
  emoji: string | null;
  category_id: string | null;
  log_channel_id: string | null;
  support_roles: string[] | null;
  ticket_name_template: string | null;
  max_open_per_user: number | null;
  enabled: boolean | null;
  updated_at: string | null;
  meta: Json | null;
};

export type TicketRow = {
  id: number;
  guild_id: string;
  panel_key: string | null;
  channel_id: string | null;
  creator_id: string | null;
  claimed_by: string | null;
  status: string | null;
  subject: string | null;
  topic: string | null;
  transcript_url: string | null;
  created_at: string | null;
  closed_at: string | null;
  updated_at: string | null;
  meta: Json | null;
};

export type VoicemasterConfigRow = {
  guild_id: string;
  enabled: boolean | null;
  creator_channel_id: string | null;
  category_id: string | null;
  log_channel_id: string | null;
  room_name_template: string | null;
  default_user_limit: number | null;
  default_bitrate: number | null;
  allow_owner_rename: boolean | null;
  allow_owner_limit: boolean | null;
  allow_owner_lock: boolean | null;
  allow_owner_hide: boolean | null;
  updated_at: string | null;
  hubs: Json | null;
};

export type VoicemasterRoomRow = {
  channel_id: string;
  guild_id: string;
  owner_id: string | null;
  name: string | null;
  user_limit: number | null;
  bitrate: number | null;
  member_count: number | null;
  locked: boolean | null;
  hidden: boolean | null;
  created_at: string | null;
  updated_at: string | null;
  hub_id: string | null;
  allow_users: string[] | null;
  deny_users: string[] | null;
  panel_channel_id: string | null;
  panel_message_id: string | null;
  console_thread_id: string | null;
};

export type GuildDashboardData = {
  guild: BotGuildRow | null;
  config: GuildConfigRow | null;
  customizations: ServerCustomizationRow | null;
  serverPanel: ServerPanelRow | null;
  brandRole: BrandRoleRow | null;
  roles: GuildRoleRow[];
  channels: GuildChannelRow[];
  commandsRegistry: CommandRegistryRow[];
  commandGroups: CommandGroupRow[];
  commandPermissions: CommandPermissionRow[];
  customCommands: CustomCommandRow[];
  smartFilter: SmartFilterRow | null;
  guildRules: GuildRuleRow[];
  logSettings: GuildLogSettingRow[];
  recentLogEntries: GuildLogEntryRow[];
  ticketConfig: TicketConfigRow | null;
  ticketPanels: TicketPanelRow[];
  recentTickets: TicketRow[];
  voicemasterConfig: VoicemasterConfigRow | null;
  voicemasterRooms: VoicemasterRoomRow[];
  premiumSettings: GuildPremiumSettingsRow | null;
  premiumAnalytics: PremiumAnalyticsSummary;
  recentAnalyticsEvents: BotAnalyticsEventRow[];
  premiumEnabled: boolean;
  syncState: DashboardSyncStateRow | null;
};
