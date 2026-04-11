"use client";

import { startTransition, useDeferredValue, useEffect, useMemo, useState } from "react";

import { TagSelector, type TagSelectorOption } from "@/components/dashboard/tag-selector";
import type { DashboardSyncStateRow, GuildDashboardData } from "@/lib/types";
import { formatDate, safeJsonParse } from "@/lib/utils";

type Props = {
  guildId: string;
  data: GuildDashboardData;
};

type DashboardSectionId =
  | "overview"
  | "commands"
  | "moderation"
  | "tickets"
  | "voice"
  | "branding"
  | "premium";

type CommandSubsectionId = "registry" | "groups" | "access" | "custom";
type OverviewModuleKey = "moderation" | "lunarialog" | "tickets" | "voicemaster" | "serverpanel";
type VoiceToggleKey = "allowOwnerRename" | "allowOwnerLimit" | "allowOwnerLock" | "allowOwnerHide";
type PremiumBrandToggleKey = "brandRoleHoist" | "brandRoleMentionable";
type PremiumWelcomeToggleKey = "welcomeEnabled" | "leaveEnabled" | "sendDm";
type CustomCommandResponseMode = "text" | "embed";

type CustomCommandEditorState = {
  command_name: string;
  description: string;
  trigger_type: "prefix";
  response_mode: CustomCommandResponseMode;
  response_text: string;
  embed_title: string;
  embed_description: string;
  embed_color: string;
  aliases: string;
  enabled: boolean;
  cooldown: number;
  allowed_roles: string[];
  denied_roles: string[];
  allowed_channels: string[];
  denied_channels: string[];
  ephemeral: boolean;
  delete_trigger: boolean;
};

const dashboardSections: Array<{ id: DashboardSectionId; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "commands", label: "Commands" },
  { id: "moderation", label: "Moderation" },
  { id: "tickets", label: "Tickets" },
  { id: "voice", label: "VoiceMaster" },
  { id: "branding", label: "Branding" },
  { id: "premium", label: "Premium" },
];

const commandSubsections: Array<{ id: CommandSubsectionId; label: string }> = [
  { id: "registry", label: "Registry" },
  { id: "groups", label: "Groups" },
  { id: "access", label: "Access Rules" },
  { id: "custom", label: "Custom" },
];

const premiumFeatureOptions = [
  { key: "branding", label: "Premium Branding", description: "Webhook style, embeds, footer и branding-слой бота." },
  { key: "brand-role", label: "Brand Role", description: "Фирменная роль сервера с кастомным оформлением." },
  { key: "analytics", label: "Analytics Pro", description: "Расширенная аналитика по событиям и командам сервера." },
  { key: "server-panel", label: "Server Panel Customization", description: "Кастомный серверный panel-блок и тексты." },
  { key: "welcome", label: "Welcome / Leave Branding", description: "Приветствия, уходы и DM-оформление под бренд." },
] as const;

const overviewModuleCards: Array<{
  key: OverviewModuleKey;
  title: string;
  description: string;
}> = [
  {
    key: "moderation",
    title: "Moderation",
    description: "Фильтры, staff-инструменты, правила и server control.",
  },
  {
    key: "lunarialog",
    title: "Lunaria Log",
    description: "Логи событий, действия участников и служебные записи.",
  },
  {
    key: "tickets",
    title: "Tickets",
    description: "Панели обращений, support queue и ticket flow.",
  },
  {
    key: "voicemaster",
    title: "VoiceMaster",
    description: "Временные комнаты, ownership и voice automation.",
  },
  {
    key: "serverpanel",
    title: "Server Panel",
    description: "Системная панель сервера и публичные служебные блоки.",
  },
] as const;

const voiceToggleCards: Array<{
  key: VoiceToggleKey;
  title: string;
  description: string;
}> = [
  {
    key: "allowOwnerRename",
    title: "Owner Rename",
    description: "Создатель комнаты может менять название временного канала.",
  },
  {
    key: "allowOwnerLimit",
    title: "Owner Limit",
    description: "Создатель может менять лимит пользователей в своей комнате.",
  },
  {
    key: "allowOwnerLock",
    title: "Owner Lock",
    description: "Создатель может закрывать комнату от новых участников.",
  },
  {
    key: "allowOwnerHide",
    title: "Owner Hide",
    description: "Создатель может скрывать комнату. Обычно это premium-режим.",
  },
] as const;

const premiumBrandToggleCards: Array<{
  key: PremiumBrandToggleKey;
  title: string;
  description: string;
}> = [
  {
    key: "brandRoleHoist",
    title: "Hoist Role",
    description: "Выносить brand role в отдельный блок списка ролей.",
  },
  {
    key: "brandRoleMentionable",
    title: "Mentionable",
    description: "Разрешить участникам пинговать фирменную роль сервера.",
  },
] as const;

const premiumWelcomeToggleCards: Array<{
  key: PremiumWelcomeToggleKey;
  title: string;
  description: string;
}> = [
  {
    key: "welcomeEnabled",
    title: "Welcome Messages",
    description: "Включить брендированные сообщения о входе участников.",
  },
  {
    key: "leaveEnabled",
    title: "Leave Messages",
    description: "Включить брендированные сообщения об уходе участников.",
  },
  {
    key: "sendDm",
    title: "Welcome DM",
    description: "Отправлять личное сообщение новому участнику при входе.",
  },
] as const;

function toggleValue(list: string[], value: string) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function csvList(value: string[] | null | undefined) {
  return Array.isArray(value) ? value.join(", ") : "";
}

function parseCsv(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeCommandName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_-]+/gu, "_")
    .replace(/^_+|_+$/g, "");
}

function createEmptyCustomCommand(): CustomCommandEditorState {
  return {
    command_name: "",
    description: "",
    trigger_type: "prefix",
    response_mode: "text",
    response_text: "",
    embed_title: "",
    embed_description: "",
    embed_color: "#a77cff",
    aliases: "",
    enabled: true,
    cooldown: 0,
    allowed_roles: [],
    denied_roles: [],
    allowed_channels: [],
    denied_channels: [],
    ephemeral: false,
    delete_trigger: false,
  };
}

function buildCustomCommandPreview(prefix: string, commandName: string, aliases: string) {
  const normalizedPrefix = prefix || ".";
  const name = normalizeCommandName(commandName);
  const aliasList = parseCsv(aliases);
  if (!name) return `${normalizedPrefix}your_command`;
  if (aliasList.length === 0) return `${normalizedPrefix}${name}`;
  return `${normalizedPrefix}${name} / ${aliasList.slice(0, 2).map((alias) => `${normalizedPrefix}${normalizeCommandName(alias)}`).join(" / ")}`;
}

function summarizeSyncState(syncState: DashboardSyncStateRow | null) {
  if (!syncState) return "Синхронизация ещё не настроена.";
  const status = String(syncState.status || "idle").toLowerCase();
  if (status === "queued") return `В очереди: rev ${syncState.revision || 0}`;
  if (status === "processing") return `Применяется: rev ${syncState.revision || 0}`;
  if (status === "applied") return `Применено: rev ${syncState.bot_applied_revision || syncState.revision || 0}`;
  if (status === "error") return syncState.last_error || "Ошибка синхронизации";
  return `Ожидание: rev ${syncState.revision || 0}`;
}

export function GuildDashboardClient({ guildId, data }: Props) {
  const [status, setStatus] = useState<Record<string, string>>({});
  const [syncState, setSyncState] = useState<DashboardSyncStateRow | null>(data.syncState);
  const [activeSection, setActiveSection] = useState<DashboardSectionId>("overview");
  const [activeCommandPanel, setActiveCommandPanel] = useState<CommandSubsectionId>("registry");
  const [commandSearch, setCommandSearch] = useState("");
  const [commandFilter, setCommandFilter] = useState<"all" | "enabled" | "disabled" | "allowlist">("all");

  const [overview, setOverview] = useState({
    prefix: data.config?.prefix || ".",
    language: data.config?.language || "ru",
    appealsChannelId: data.config?.appeals_channel_id || "",
    dmPunishEnabled: data.config?.dm_punish_enabled ?? true,
    modRoles: data.config?.mod_roles || [],
    adminRoles: data.config?.admin_roles || [],
    enabledModules: {
      moderation: data.config?.enabled_modules?.moderation ?? true,
      lunarialog: data.config?.enabled_modules?.lunarialog ?? true,
      tickets: data.config?.enabled_modules?.tickets ?? false,
      voicemaster: data.config?.enabled_modules?.voicemaster ?? false,
      serverpanel: data.config?.enabled_modules?.serverpanel ?? true,
    },
  });

  const [commandPermissions, setCommandPermissions] = useState(() =>
    data.commandsRegistry.map((command) => {
      const current = data.commandPermissions.find((item) => item.command_name === command.command_name);
        return {
          command_name: command.command_name,
          enabled: current?.enabled ?? true,
          cooldown: current?.cooldown ?? 0,
          mode: current?.mode || "inherit",
          allow_roles: csvList(current?.allow_roles),
          deny_roles: csvList(current?.deny_roles),
          allow_users: csvList(current?.allow_users),
          deny_users: csvList(current?.deny_users),
          allow_groups: csvList(current?.allow_groups),
          deny_groups: csvList(current?.deny_groups),
          allow_channels: csvList(current?.allow_channels),
          deny_channels: csvList(current?.deny_channels),
        };
      }),
    );

  const [commandGroups, setCommandGroups] = useState(
    (data.commandGroups || []).map((group) => ({
      group_id: group.group_id,
      name: group.name || "",
      roles: csvList(group.roles),
      scopes: csvList(group.scopes),
      color: group.color || "",
      is_default: group.is_default ?? false,
    })),
  );

  const [customCommands, setCustomCommands] = useState<CustomCommandEditorState[]>(
    (data.customCommands || []).map((command) => {
      const embed =
        command.embed && typeof command.embed === "object" && !Array.isArray(command.embed)
          ? (command.embed as Record<string, unknown>)
          : {};
      const meta =
        command.meta && typeof command.meta === "object" && !Array.isArray(command.meta)
          ? (command.meta as Record<string, unknown>)
          : {};

      return {
        command_name: command.command_name,
        description: command.description || "",
        trigger_type: "prefix",
        response_mode: command.response_mode === "embed" ? "embed" : "text",
        response_text: command.response_text || "",
        embed_title: String(embed.title || ""),
        embed_description: String(embed.description || command.response_text || ""),
        embed_color: String(embed.color || "#a77cff"),
        aliases: (command.aliases || []).join(", "),
        enabled: command.enabled ?? true,
        cooldown: command.cooldown ?? 0,
        allowed_roles: command.allowed_roles || [],
        denied_roles: command.denied_roles || [],
        allowed_channels: command.allowed_channels || [],
        denied_channels: command.denied_channels || [],
        ephemeral: meta.ephemeral === true,
        delete_trigger: meta.delete_trigger === true,
      };
    }),
  );

  const [moderation, setModeration] = useState({
    smartFilterEnabled: data.smartFilter?.enabled ?? false,
    smartFilterAction: data.smartFilter?.action || "delete",
    bannedWords: (data.smartFilter?.banned_words || []).join(", "),
    regexRules: (data.smartFilter?.regex_rules || []).join("\n"),
    globalLogChannelId: data.logSettings.find((item) => item.log_type === "all")?.channel_id || "",
    globalLogColor: data.logSettings.find((item) => item.log_type === "all")?.embed_color || "",
    rules:
      data.guildRules.length > 0
        ? data.guildRules.map((rule) => ({
            title: rule.title || "",
            content: rule.content || "",
            enabled: rule.enabled ?? true,
          }))
        : [{ title: "", content: "", enabled: true }],
  });

  const [tickets, setTickets] = useState({
    enabled: data.ticketConfig?.enabled ?? false,
    defaultCategoryId: data.ticketConfig?.default_category_id || "",
    defaultLogChannelId: data.ticketConfig?.default_log_channel_id || "",
    transcriptChannelId: data.ticketConfig?.transcript_channel_id || "",
    supportRoles: data.ticketConfig?.support_roles || [],
    maxOpenPerUser: data.ticketConfig?.max_open_per_user ?? 1,
    panels:
      data.ticketPanels.length > 0
        ? data.ticketPanels.map((panel) => ({
            panel_key: panel.panel_key,
            panel_name: panel.panel_name || "",
            panel_channel_id: panel.panel_channel_id || "",
            title: panel.title || "",
            description: panel.description || "",
            button_label: panel.button_label || "",
            button_style: panel.button_style || "primary",
            emoji: panel.emoji || "🎫",
            category_id: panel.category_id || "",
            log_channel_id: panel.log_channel_id || "",
            ticket_name_template: panel.ticket_name_template || "ticket-{id}",
            enabled: panel.enabled ?? true,
          }))
        : [
            {
              panel_key: "default",
              panel_name: "Main Panel",
              panel_channel_id: "",
              title: "🎫 Тикеты поддержки",
              description: "Нажми кнопку ниже, чтобы создать тикет.",
              button_label: "Создать тикет",
              button_style: "primary",
              emoji: "🎫",
              category_id: "",
              log_channel_id: "",
              ticket_name_template: "ticket-{id}",
              enabled: true,
            },
          ],
  });

  const [voice, setVoice] = useState({
    enabled: data.voicemasterConfig?.enabled ?? false,
    creatorChannelId: data.voicemasterConfig?.creator_channel_id || "",
    categoryId: data.voicemasterConfig?.category_id || "",
    logChannelId: data.voicemasterConfig?.log_channel_id || "",
    roomNameTemplate: data.voicemasterConfig?.room_name_template || "🎧 {user}",
    defaultUserLimit: data.voicemasterConfig?.default_user_limit ?? 0,
    defaultBitrate: data.voicemasterConfig?.default_bitrate ?? 64,
    allowOwnerRename: data.voicemasterConfig?.allow_owner_rename ?? true,
    allowOwnerLimit: data.voicemasterConfig?.allow_owner_limit ?? true,
    allowOwnerLock: data.voicemasterConfig?.allow_owner_lock ?? true,
    allowOwnerHide: data.voicemasterConfig?.allow_owner_hide ?? false,
    hubs: JSON.stringify(data.voicemasterConfig?.hubs || {}, null, 2),
  });

  const [branding, setBranding] = useState({
    embedColor: data.customizations?.embed_color || "#A77CFF",
    footerText: data.customizations?.footer_text || "Lunaria Fox",
    footerIconUrl: data.customizations?.footer_icon_url || "",
    webhookName: data.customizations?.webhook_name || "Lunaria Fox",
    webhookAvatarUrl: data.customizations?.webhook_avatar_url || "",
    bannerUrl: data.customizations?.banner_url || "",
    panelEnabled: data.serverPanel?.enabled ?? false,
    panelChannelId: data.serverPanel?.channel_id || "",
  });

  const [premium, setPremium] = useState({
    premiumActive: data.premiumSettings?.premium_active ?? data.premiumEnabled,
    planName: data.premiumSettings?.plan_name || "premium",
    features:
      (data.premiumSettings?.features || []).length > 0
        ? (data.premiumSettings?.features || [])
        : ["branding", "brand-role", "analytics", "server-panel", "welcome"],
    brandRoleName: data.brandRole?.role_name || "L U N A R I A   F O X",
    brandRoleColor: data.brandRole?.color || "#9c7cff",
    brandRoleHoist: data.brandRole?.hoist ?? true,
    brandRoleMentionable: data.brandRole?.mentionable ?? false,
    serverPanelTitle:
      (data.premiumSettings?.server_panel_settings as { title?: string } | null)?.title || "",
    serverPanelDescription:
      (data.premiumSettings?.server_panel_settings as { description?: string } | null)?.description || "",
    serverPanelFooter:
      (data.premiumSettings?.server_panel_settings as { footer?: string } | null)?.footer || "",
    welcomeEnabled:
      (data.premiumSettings?.welcome_settings as { welcome_enabled?: boolean } | null)?.welcome_enabled ?? false,
    welcomeChannelId:
      (data.premiumSettings?.welcome_settings as { welcome_channel_id?: string } | null)?.welcome_channel_id || "",
    welcomeTitle:
      (data.premiumSettings?.welcome_settings as { welcome_title?: string } | null)?.welcome_title || "",
    welcomeMessage:
      (data.premiumSettings?.welcome_settings as { welcome_message?: string } | null)?.welcome_message || "",
    leaveEnabled:
      (data.premiumSettings?.welcome_settings as { leave_enabled?: boolean } | null)?.leave_enabled ?? false,
    leaveChannelId:
      (data.premiumSettings?.welcome_settings as { leave_channel_id?: string } | null)?.leave_channel_id || "",
    leaveTitle:
      (data.premiumSettings?.welcome_settings as { leave_title?: string } | null)?.leave_title || "",
    leaveMessage:
      (data.premiumSettings?.welcome_settings as { leave_message?: string } | null)?.leave_message || "",
    sendDm:
      (data.premiumSettings?.welcome_settings as { send_dm?: boolean } | null)?.send_dm ?? false,
    dmMessage:
      (data.premiumSettings?.welcome_settings as { dm_message?: string } | null)?.dm_message || "",
  });

  const hasPremiumAccess = Boolean(data.premiumEnabled || data.premiumSettings?.premium_active);

  const roleOptions = useMemo<TagSelectorOption[]>(
    () =>
      data.roles.map((role) => ({
        value: role.role_id,
        label: role.name,
        hint: role.role_id,
      })),
    [data.roles],
  );

  const channelOptions = useMemo<TagSelectorOption[]>(
    () =>
      data.channels.map((channel) => ({
        value: channel.channel_id,
        label: `# ${channel.name}`,
        hint: channel.channel_id,
      })),
    [data.channels],
  );

  const groupOptions = useMemo<TagSelectorOption[]>(
    () =>
      commandGroups
        .filter((group) => group.group_id.trim())
        .map((group) => ({
          value: group.group_id.trim().toLowerCase(),
          label: group.name.trim() || group.group_id.trim().toLowerCase(),
          hint: group.group_id.trim().toLowerCase(),
        })),
    [commandGroups],
  );

  const deferredCommandSearch = useDeferredValue(commandSearch);

  const commandRegistryMap = useMemo(
    () =>
      new Map(
        data.commandsRegistry.map((command) => [
          command.command_name,
          {
            description: command.description,
            category: command.category,
            commandType: command.command_type,
          },
        ]),
      ),
    [data.commandsRegistry],
  );

  const filteredCommandPermissions = useMemo(() => {
    const searchValue = deferredCommandSearch.trim().toLowerCase();

    return commandPermissions
      .map((permission, index) => ({
        index,
        permission,
        registry: commandRegistryMap.get(permission.command_name),
      }))
      .filter(({ permission, registry }) => {
        if (commandFilter === "enabled" && !permission.enabled) return false;
        if (commandFilter === "disabled" && permission.enabled) return false;
        if (commandFilter === "allowlist" && permission.mode !== "allowlist") return false;

        if (!searchValue) return true;

        return [
          permission.command_name,
          registry?.description || "",
          registry?.category || "",
          registry?.commandType || "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(searchValue);
      });
  }, [commandFilter, commandPermissions, commandRegistryMap, deferredCommandSearch]);

  const commandStats = useMemo(
    () => ({
      total: commandPermissions.length,
      enabled: commandPermissions.filter((permission) => permission.enabled).length,
      allowlist: commandPermissions.filter((permission) => permission.mode === "allowlist").length,
      custom: customCommands.length,
    }),
    [commandPermissions, customCommands.length],
  );

  useEffect(() => {
    let disposed = false;

    const refresh = async () => {
      try {
        const response = await fetch(`/api/dashboard/${guildId}/sync`, {
          method: "GET",
          cache: "no-store",
        });
        if (!response.ok) return;
        const body = (await response.json()) as { syncState?: DashboardSyncStateRow | null };
        if (!disposed) {
          setSyncState(body.syncState || null);
        }
      } catch {
        // keep the latest known state on client
      }
    };

    refresh().catch(() => {});
    const timer = setInterval(() => {
      refresh().catch(() => {});
    }, 7000);

    return () => {
      disposed = true;
      clearInterval(timer);
    };
  }, [guildId]);

  async function save(section: string, payload: unknown) {
    setStatus((current) => ({ ...current, [section]: "Saving..." }));

    startTransition(async () => {
      try {
        const response = await fetch(`/api/dashboard/${guildId}/${section}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        const body = (await response.json().catch(() => ({}))) as {
          error?: string;
          syncState?: DashboardSyncStateRow | null;
        };

        if (!response.ok) {
          throw new Error(body.error || "Request failed.");
        }

        if (body.syncState) {
          setSyncState(body.syncState);
        }

        setStatus((current) => ({
          ...current,
          [section]: body.syncState ? `Saved. ${summarizeSyncState(body.syncState)}` : "Saved.",
        }));
      } catch (error) {
        setStatus((current) => ({
          ...current,
          [section]: error instanceof Error ? error.message : "Save failed.",
        }));
      }
    });
  }

  function updateCommandPermissionCsv(
    index: number,
    key:
      | "allow_roles"
      | "deny_roles"
      | "allow_channels"
      | "deny_channels"
      | "allow_groups"
      | "deny_groups"
      | "allow_users"
      | "deny_users",
    next: string[],
  ) {
    setCommandPermissions((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: next.join(", ") } : item,
      ),
    );
  }

  function updateCommandPermission(
    index: number,
    patch: Partial<(typeof commandPermissions)[number]>,
  ) {
    setCommandPermissions((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    );
  }

  function updateCustomCommand(
    index: number,
    patch: Partial<CustomCommandEditorState>,
  ) {
    setCustomCommands((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    );
  }

  return (
    <div className="dashboard-grid">
      <aside className="dashboard-sidebar panel">
        <div className="sync-orb">
          <span className={`sync-dot sync-${String(syncState?.status || "idle").toLowerCase()}`} />
          <div>
            <strong>Синхронизация</strong>
            <p>{summarizeSyncState(syncState)}</p>
          </div>
        </div>
        <span className="eyebrow">Sections</span>
        <div className="sidebar-links">
          {dashboardSections.map((section) => (
            <button
              className={activeSection === section.id ? "sidebar-link-active" : ""}
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              type="button"
            >
              {section.label}
            </button>
          ))}
        </div>
      </aside>

      <div className="dashboard-sections">
        <section className="dashboard-section panel control-plane-panel">
          <div className="dashboard-head">
            <div>
              <span className="eyebrow">Sync Status</span>
              <h2>Настройки применяются к боту</h2>
            </div>
            <span className={`badge ${syncState?.status === "applied" ? "success" : syncState?.status === "error" ? "warn" : "muted"}`}>
              {syncState?.status || "fallback"}
            </span>
          </div>

          <div className="control-grid">
            <div className="control-card">
              <strong>Текущая revision</strong>
              <span>{syncState?.revision || 0}</span>
            </div>
            <div className="control-card">
              <strong>Применённая revision</strong>
              <span>{syncState?.bot_applied_revision || 0}</span>
            </div>
            <div className="control-card">
              <strong>Последнее сохранение</strong>
              <span>{formatDate(syncState?.requested_at)}</span>
            </div>
            <div className="control-card">
              <strong>Последнее применение</strong>
              <span>{formatDate(syncState?.bot_applied_at)}</span>
            </div>
          </div>

          <div className="panel-note control-plane-note">
            <strong>Как это работает:</strong> сайт сохраняет настройки, бот получает новую revision и применяет
            изменения в работе сервера.
            {syncState?.last_section ? ` Последний раздел: ${syncState.last_section}.` : ""}
            {syncState?.last_error ? ` Ошибка: ${syncState.last_error}` : ""}
          </div>
        </section>

        <section
          className={`dashboard-section panel ${activeSection === "overview" ? "" : "dashboard-section-hidden"}`}
          id="overview"
        >
          <div className="dashboard-head">
            <div>
              <span className="eyebrow">Overview</span>
              <h2>Базовые настройки сервера</h2>
            </div>
            <span className="badge muted">{status.overview || "Not saved yet"}</span>
          </div>

          <div className="form-grid">
            <div className="field">
              <label>Prefix</label>
              <input value={overview.prefix} onChange={(event) => setOverview({ ...overview, prefix: event.target.value })} />
            </div>
            <div className="field">
              <label>Language</label>
              <select value={overview.language} onChange={(event) => setOverview({ ...overview, language: event.target.value })}>
                <option value="ru">ru</option>
                <option value="en">en</option>
              </select>
            </div>
            <div className="field">
              <label>Appeals Channel</label>
              <select
                value={overview.appealsChannelId}
                onChange={(event) => setOverview({ ...overview, appealsChannelId: event.target.value })}
              >
                <option value="">Not set</option>
                {data.channels.map((channel) => (
                  <option key={channel.channel_id} value={channel.channel_id}>
                    {channel.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>DM punish enabled</label>
              <select
                value={overview.dmPunishEnabled ? "true" : "false"}
                onChange={(event) =>
                  setOverview({ ...overview, dmPunishEnabled: event.target.value === "true" })
                }
              >
                <option value="true">Enabled</option>
                <option value="false">Disabled</option>
              </select>
            </div>
          </div>

          <div className="section">
            <h3>Modules</h3>
            <div className="module-card-grid">
              {overviewModuleCards.map((module) => {
                const enabled = overview.enabledModules[module.key];

                return (
                  <button
                    aria-pressed={enabled}
                    className={`module-toggle-card ${enabled ? "module-toggle-card-active" : ""}`}
                    key={module.key}
                    onClick={() =>
                      setOverview({
                        ...overview,
                        enabledModules: {
                          ...overview.enabledModules,
                          [module.key]: !enabled,
                        },
                      })
                    }
                    type="button"
                  >
                    <div className="module-toggle-top">
                      <span className="module-toggle-state">{enabled ? "Enabled" : "Disabled"}</span>
                      <span className={`module-toggle-knob ${enabled ? "module-toggle-knob-active" : ""}`}>
                        <span />
                      </span>
                    </div>
                    <strong>{module.title}</strong>
                    <p>{module.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="section">
            <h3>Moderator Roles</h3>
            <TagSelector
              emptyText="Роли не найдены."
              onChange={(next) => setOverview({ ...overview, modRoles: next })}
              options={roleOptions}
              placeholder="Выбери роли модераторов"
              searchPlaceholder="Найти роль"
              selected={overview.modRoles}
            />
          </div>

          <div className="section">
            <h3>Admin Roles</h3>
            <TagSelector
              emptyText="Роли не найдены."
              onChange={(next) => setOverview({ ...overview, adminRoles: next })}
              options={roleOptions}
              placeholder="Выбери роли администраторов"
              searchPlaceholder="Найти роль"
              selected={overview.adminRoles}
            />
          </div>

          <button
            className="primary-button"
            onClick={() =>
              save("overview", {
                ...overview,
                appealsChannelId: overview.appealsChannelId || null,
              })
            }
            type="button"
          >
            Save Overview
          </button>
        </section>

        <section
          className={`dashboard-section panel ${activeSection === "commands" ? "" : "dashboard-section-hidden"}`}
          id="commands"
        >
          <div className="dashboard-head">
            <div>
              <span className="eyebrow">Commands</span>
              <h2>Командный центр сервера</h2>
            </div>
            <span className="badge muted">{status.commands || "Editing locally"}</span>
          </div>

          <div className="command-summary-grid">
            <div className="command-summary-card">
              <span>Всего команд</span>
              <strong>{commandStats.total}</strong>
              <p>Полный slash registry для сервера.</p>
            </div>
            <div className="command-summary-card">
              <span>Активные</span>
              <strong>{commandStats.enabled}</strong>
              <p>Доступны участникам и staff прямо сейчас.</p>
            </div>
            <div className="command-summary-card">
              <span>Allowlist режим</span>
              <strong>{commandStats.allowlist}</strong>
              <p>Команды с точечными access rules.</p>
            </div>
            <div className="command-summary-card">
              <span>Custom commands</span>
              <strong>{commandStats.custom}</strong>
              <p>Локальные ответы и server-specific utilities.</p>
            </div>
          </div>

          <div className="subsection-switcher">
            {commandSubsections.map((section) => (
              <button
                className={activeCommandPanel === section.id ? "subsection-switcher-active" : ""}
                key={section.id}
                onClick={() => setActiveCommandPanel(section.id)}
                type="button"
              >
                {section.label}
              </button>
            ))}
          </div>

          <div className={activeCommandPanel === "registry" ? "section" : "section dashboard-section-hidden"}>
            <div className="command-toolbar">
              <div className="field command-search-field">
                <label>Search command</label>
                <input
                  onChange={(event) => setCommandSearch(event.target.value)}
                  placeholder="Например uptime, статистика, moderation"
                  value={commandSearch}
                />
              </div>

              <div className="command-filter-cluster">
                <span className="muted">Показывать</span>
                {(
                  [
                    ["all", "Все"],
                    ["enabled", "Активные"],
                    ["disabled", "Выключенные"],
                    ["allowlist", "Allowlist"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    className={commandFilter === value ? "command-filter-active" : ""}
                    key={value}
                    onClick={() => setCommandFilter(value)}
                    type="button"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="panel-note command-panel-note">
              Здесь управляется registry slash-команд. Изменения сохраняются в Supabase и потом применяются ботом через
              sync revision.
            </div>

            <div className="command-card-grid">
              {filteredCommandPermissions.length > 0 ? (
                filteredCommandPermissions.map(({ permission, index, registry }) => (
                  <article className="command-registry-card" key={permission.command_name}>
                    <div className="command-registry-head">
                      <div>
                        <div className="command-title-row">
                          <span className="command-slash">/{permission.command_name}</span>
                          {registry?.category ? <span className="command-mini-badge">{registry.category}</span> : null}
                          {registry?.commandType ? <span className="command-mini-badge">{registry.commandType}</span> : null}
                        </div>
                        <p>{registry?.description || "Команда без описания в registry."}</p>
                      </div>
                      <span className={`badge ${permission.enabled ? "success" : "warn"}`}>
                        {permission.enabled ? "Enabled" : "Disabled"}
                      </span>
                    </div>

                    <div className="command-card-controls">
                      <button
                        aria-pressed={permission.enabled}
                        className={`toggle-switch ${permission.enabled ? "toggle-switch-active" : ""}`}
                        onClick={() => updateCommandPermission(index, { enabled: !permission.enabled })}
                        type="button"
                      >
                        <span />
                        <strong>{permission.enabled ? "Команда включена" : "Команда выключена"}</strong>
                      </button>

                      <div className="field compact-field">
                        <label>Cooldown</label>
                        <input
                          min="0"
                          onChange={(event) =>
                            updateCommandPermission(index, {
                              cooldown: Number(event.target.value) || 0,
                            })
                          }
                          type="number"
                          value={permission.cooldown}
                        />
                      </div>
                    </div>

                    <div className="mode-segment">
                      {(
                        [
                          ["inherit", "Inherit"],
                          ["allowlist", "Allowlist"],
                        ] as const
                      ).map(([mode, label]) => (
                        <button
                          className={permission.mode === mode ? "mode-segment-active" : ""}
                          key={mode}
                          onClick={() => updateCommandPermission(index, { mode })}
                          type="button"
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </article>
                ))
              ) : (
                <div className="panel-note">По текущему поиску и фильтру команды не найдены.</div>
              )}
            </div>
          </div>

          <div className={activeCommandPanel === "groups" ? "section" : "section dashboard-section-hidden"}>
            <div className="inline-row">
              <div>
                <h3>Command Groups</h3>
                <p className="muted">Группы нужны для быстрой раздачи доступов через bundle ролей.</p>
              </div>
              <button
                className="secondary-button"
                onClick={() =>
                  setCommandGroups((current) => [
                    ...current,
                    {
                      group_id: "",
                      name: "",
                      roles: "",
                      scopes: "",
                      color: "",
                      is_default: false,
                    },
                  ])
                }
                type="button"
              >
                Add group
              </button>
            </div>

            <div className="editor-card-stack">
              {commandGroups.length > 0 ? (
                commandGroups.map((group, index) => (
                  <article className="editor-card" key={`${group.group_id || "group"}-${index}`}>
                    <div className="editor-card-head">
                      <div>
                        <strong>{group.name || group.group_id || `Group ${index + 1}`}</strong>
                        <p>{group.group_id ? `Key: ${group.group_id}` : "Новая группа команд."}</p>
                      </div>
                      <div className="inline-row">
                        {group.is_default ? <span className="badge success">Default</span> : null}
                        <button
                          className="editor-remove"
                          onClick={() =>
                            setCommandGroups((current) => current.filter((_, itemIndex) => itemIndex !== index))
                          }
                          type="button"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                    <div className="form-grid">
                      <div className="field">
                        <label>Group key</label>
                        <input
                          value={group.group_id}
                          onChange={(event) =>
                            setCommandGroups((current) =>
                              current.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, group_id: event.target.value } : item,
                              ),
                            )
                          }
                        />
                      </div>
                      <div className="field">
                        <label>Name</label>
                        <input
                          value={group.name}
                          onChange={(event) =>
                            setCommandGroups((current) =>
                              current.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, name: event.target.value } : item,
                              ),
                            )
                          }
                        />
                      </div>
                      <div className="field">
                        <label>Roles</label>
                        <TagSelector
                          emptyText="Роли не найдены."
                          onChange={(next) =>
                            setCommandGroups((current) =>
                              current.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, roles: next.join(", ") } : item,
                              ),
                            )
                          }
                          options={roleOptions}
                          placeholder="Выбери роли группы"
                          searchPlaceholder="Найти роль"
                          selected={parseCsv(group.roles)}
                        />
                      </div>
                      <div className="field">
                        <label>Scopes</label>
                        <input
                          value={group.scopes}
                          placeholder="moderation, tickets, premium"
                          onChange={(event) =>
                            setCommandGroups((current) =>
                              current.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, scopes: event.target.value } : item,
                              ),
                            )
                          }
                        />
                      </div>
                      <div className="field">
                        <label>Accent color</label>
                        <input
                          value={group.color}
                          placeholder="#9b7cff"
                          onChange={(event) =>
                            setCommandGroups((current) =>
                              current.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, color: event.target.value } : item,
                              ),
                            )
                          }
                        />
                      </div>
                      <button
                        aria-pressed={group.is_default}
                        className={`module-toggle-card command-inline-toggle ${group.is_default ? "module-toggle-card-active" : ""}`}
                        onClick={() =>
                          setCommandGroups((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, is_default: !item.is_default } : item,
                            ),
                          )
                        }
                        type="button"
                      >
                        <div className="module-toggle-top">
                          <span className="module-toggle-state">{group.is_default ? "Enabled" : "Disabled"}</span>
                          <span className={`module-toggle-knob ${group.is_default ? "module-toggle-knob-active" : ""}`}>
                            <span />
                          </span>
                        </div>
                        <strong>Default Group</strong>
                        <p>Используется как базовая группа для server access presets.</p>
                      </button>
                    </div>
                  </article>
                ))
              ) : (
                <div className="panel-note">Группы команд пока не заданы. Они нужны для allow/deny через role bundles.</div>
              )}
            </div>
          </div>

          <div className={activeCommandPanel === "access" ? "section" : "section dashboard-section-hidden"}>
            <div className="inline-row">
              <div>
                <h3>Advanced Access Rules</h3>
                <p className="muted">Точные allow/deny правила для ролей, каналов, групп и пользователей.</p>
              </div>
              <span className="badge muted">{commandPermissions.length} command(s)</span>
            </div>
            <div className="editor-card-stack">
              {commandPermissions.length > 0 ? (
                commandPermissions.map((permission, index) => {
                  const registry = commandRegistryMap.get(permission.command_name);

                  return (
                  <article className="editor-card access-rule-card" key={`access-${permission.command_name}`}>
                    <div className="editor-card-head">
                      <div>
                        <strong>/{permission.command_name}</strong>
                        <p>{registry?.description || "Точные ограничения доступа для этой команды."}</p>
                      </div>
                      <div className="inline-row">
                        <span className={`badge ${permission.enabled ? "success" : "warn"}`}>
                          {permission.enabled ? "Enabled" : "Disabled"}
                        </span>
                        <span className="badge muted">{permission.mode}</span>
                      </div>
                    </div>
                  <div className="form-grid" style={{ marginTop: 12 }}>
                    <div className="field">
                      <label>Allow roles</label>
                      <TagSelector
                        emptyText="Роли не найдены."
                        onChange={(next) => updateCommandPermissionCsv(index, "allow_roles", next)}
                        options={roleOptions}
                        placeholder="Разрешить роли"
                        searchPlaceholder="Найти роль"
                        selected={parseCsv(permission.allow_roles)}
                      />
                    </div>
                    <div className="field">
                      <label>Deny roles</label>
                      <TagSelector
                        emptyText="Роли не найдены."
                        onChange={(next) => updateCommandPermissionCsv(index, "deny_roles", next)}
                        options={roleOptions}
                        placeholder="Запретить роли"
                        searchPlaceholder="Найти роль"
                        selected={parseCsv(permission.deny_roles)}
                      />
                    </div>
                    <div className="field">
                      <label>Allow channels</label>
                      <TagSelector
                        emptyText="Каналы не найдены."
                        onChange={(next) => updateCommandPermissionCsv(index, "allow_channels", next)}
                        options={channelOptions}
                        placeholder="Разрешить каналы"
                        searchPlaceholder="Найти канал"
                        selected={parseCsv(permission.allow_channels)}
                      />
                    </div>
                    <div className="field">
                      <label>Deny channels</label>
                      <TagSelector
                        emptyText="Каналы не найдены."
                        onChange={(next) => updateCommandPermissionCsv(index, "deny_channels", next)}
                        options={channelOptions}
                        placeholder="Запретить каналы"
                        searchPlaceholder="Найти канал"
                        selected={parseCsv(permission.deny_channels)}
                      />
                    </div>
                    <div className="field">
                      <label>Allow groups</label>
                      <TagSelector
                        emptyText="Сначала создай группу команд."
                        onChange={(next) => updateCommandPermissionCsv(index, "allow_groups", next)}
                        options={groupOptions}
                        placeholder="Разрешить группы"
                        searchPlaceholder="Найти группу"
                        selected={parseCsv(permission.allow_groups)}
                      />
                    </div>
                    <div className="field">
                      <label>Deny groups</label>
                      <TagSelector
                        emptyText="Сначала создай группу команд."
                        onChange={(next) => updateCommandPermissionCsv(index, "deny_groups", next)}
                        options={groupOptions}
                        placeholder="Запретить группы"
                        searchPlaceholder="Найти группу"
                        selected={parseCsv(permission.deny_groups)}
                      />
                    </div>
                    <div className="field">
                      <label>Allow users</label>
                      <input
                        onChange={(event) => updateCommandPermission(index, { allow_users: event.target.value })}
                        placeholder="Discord user IDs через запятую"
                        value={permission.allow_users}
                      />
                    </div>
                    <div className="field">
                      <label>Deny users</label>
                      <input
                        onChange={(event) => updateCommandPermission(index, { deny_users: event.target.value })}
                        placeholder="Discord user IDs через запятую"
                        value={permission.deny_users}
                      />
                    </div>
                  </div>
                  </article>
                  );
                })
              ) : (
                <div className="panel-note">В registry пока нет команд для настройки access rules.</div>
              )}
            </div>
          </div>

          <div className={activeCommandPanel === "custom" ? "section" : "section dashboard-section-hidden"}>
            <div className="inline-row">
              <div>
                <h3>Custom Commands</h3>
                <p className="muted">
                  Здесь создаются именно custom commands сервера. Сейчас они работают как команды по префиксу, например{" "}
                  <code>{overview.prefix}rules</code> или <code>{overview.prefix}faq</code>.
                </p>
              </div>
              <button
                className="secondary-button"
                onClick={() => setCustomCommands((current) => [...current, createEmptyCustomCommand()])}
                type="button"
              >
                Add custom command
              </button>
            </div>

            <div className="editor-card-stack">
              {customCommands.length > 0 ? (
                customCommands.map((command, index) => (
                  <article className="editor-card" key={`${command.command_name || "custom"}-${index}`}>
                    <div className="editor-card-head">
                      <div>
                        <strong>{buildCustomCommandPreview(overview.prefix, command.command_name, command.aliases)}</strong>
                        <p>
                          {command.description || "Новая кастомная команда без описания."}
                          {" "}
                          {command.response_mode === "embed" ? "Ответ отправится embed-сообщением." : "Ответ отправится обычным текстом."}
                        </p>
                      </div>
                      <div className="inline-row">
                        <span className={`badge ${command.enabled ? "success" : "warn"}`}>
                          {command.enabled ? "Enabled" : "Disabled"}
                        </span>
                        <span className="badge muted">prefix</span>
                        <button
                          className="editor-remove"
                          onClick={() =>
                            setCustomCommands((current) => current.filter((_, itemIndex) => itemIndex !== index))
                          }
                          type="button"
                        >
                          Remove
                        </button>
                      </div>
                    </div>

                    <div className="form-grid">
                      <div className="field">
                        <label>Command name</label>
                        <input
                          placeholder="rules"
                          value={command.command_name}
                          onChange={(event) =>
                            updateCustomCommand(index, { command_name: normalizeCommandName(event.target.value) })
                          }
                        />
                      </div>
                      <div className="field">
                        <label>Description</label>
                        <input
                          placeholder="Краткое описание команды"
                          value={command.description}
                          onChange={(event) => updateCustomCommand(index, { description: event.target.value })}
                        />
                      </div>
                      <div className="field">
                        <label>Aliases</label>
                        <input
                          placeholder="faq, info, правила"
                          value={command.aliases}
                          onChange={(event) => updateCustomCommand(index, { aliases: event.target.value })}
                        />
                      </div>
                      <div className="field">
                        <label>Cooldown</label>
                        <input
                          min="0"
                          type="number"
                          value={command.cooldown}
                          onChange={(event) => updateCustomCommand(index, { cooldown: Number(event.target.value) || 0 })}
                        />
                      </div>
                    </div>

                    <div className="section command-custom-section">
                      <div className="inline-row">
                        <h3>How it will work</h3>
                        <span className="badge muted">{buildCustomCommandPreview(overview.prefix, command.command_name, command.aliases)}</span>
                      </div>
                      <div className="panel-note command-panel-note">
                        Бот вызовет эту команду через текущий префикс сервера. Пример:{" "}
                        <strong>{buildCustomCommandPreview(overview.prefix, command.command_name, command.aliases)}</strong>
                      </div>
                      <div className="form-grid">
                        <div className="field">
                          <label>Trigger type</label>
                          <select value={command.trigger_type} disabled onChange={() => {}}>
                            <option value="prefix">Prefix command</option>
                          </select>
                        </div>
                        <div className="field">
                          <label>Response mode</label>
                          <select
                            value={command.response_mode}
                            onChange={(event) =>
                              updateCustomCommand(index, {
                                response_mode: event.target.value === "embed" ? "embed" : "text",
                              })
                            }
                          >
                            <option value="text">Text message</option>
                            <option value="embed">Embed message</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="module-card-grid compact-module-grid" style={{ marginTop: 14 }}>
                      <button
                        aria-pressed={command.enabled}
                        className={`module-toggle-card ${command.enabled ? "module-toggle-card-active" : ""}`}
                        onClick={() => updateCustomCommand(index, { enabled: !command.enabled })}
                        type="button"
                      >
                        <div className="module-toggle-top">
                          <span className="module-toggle-state">{command.enabled ? "Enabled" : "Disabled"}</span>
                          <span className={`module-toggle-knob ${command.enabled ? "module-toggle-knob-active" : ""}`}>
                            <span />
                          </span>
                        </div>
                        <strong>Command Status</strong>
                        <p>Включает или выключает кастомную команду без её удаления.</p>
                      </button>
                      <button
                        aria-pressed={command.ephemeral}
                        className={`module-toggle-card ${command.ephemeral ? "module-toggle-card-active" : ""}`}
                        disabled={command.response_mode !== "embed"}
                        onClick={() => updateCustomCommand(index, { ephemeral: !command.ephemeral })}
                        type="button"
                      >
                        <div className="module-toggle-top">
                          <span className="module-toggle-state">{command.ephemeral ? "Enabled" : "Disabled"}</span>
                          <span className={`module-toggle-knob ${command.ephemeral ? "module-toggle-knob-active" : ""}`}>
                            <span />
                          </span>
                        </div>
                        <strong>Ephemeral Reply</strong>
                        <p>Актуально только для embed-ответов через interaction flow.</p>
                      </button>
                      <button
                        aria-pressed={command.delete_trigger}
                        className={`module-toggle-card ${command.delete_trigger ? "module-toggle-card-active" : ""}`}
                        onClick={() => updateCustomCommand(index, { delete_trigger: !command.delete_trigger })}
                        type="button"
                      >
                        <div className="module-toggle-top">
                          <span className="module-toggle-state">{command.delete_trigger ? "Enabled" : "Disabled"}</span>
                          <span className={`module-toggle-knob ${command.delete_trigger ? "module-toggle-knob-active" : ""}`}>
                            <span />
                          </span>
                        </div>
                        <strong>Delete Trigger Message</strong>
                        <p>После ответа бот может удалить исходное сообщение с префикс-командой.</p>
                      </button>
                    </div>

                    {command.response_mode === "text" ? (
                      <div className="field" style={{ marginTop: 14 }}>
                        <label>Text response</label>
                        <textarea
                          placeholder="Например: Привет, {user}! Добро пожаловать на {server}."
                          value={command.response_text}
                          onChange={(event) => updateCustomCommand(index, { response_text: event.target.value })}
                        />
                      </div>
                    ) : (
                      <div className="section command-custom-section">
                        <div className="inline-row">
                          <h3>Embed builder</h3>
                          <span className="badge muted">Bot uses response_mode=embed</span>
                        </div>
                        <div className="form-grid">
                          <div className="field">
                            <label>Embed title</label>
                            <input
                              placeholder="Server rules"
                              value={command.embed_title}
                              onChange={(event) => updateCustomCommand(index, { embed_title: event.target.value })}
                            />
                          </div>
                          <div className="field">
                            <label>Embed color</label>
                            <input
                              placeholder="#a77cff"
                              value={command.embed_color}
                              onChange={(event) => updateCustomCommand(index, { embed_color: event.target.value })}
                            />
                          </div>
                        </div>
                        <div className="field">
                          <label>Embed description</label>
                          <textarea
                            placeholder="Поддерживаются переменные вроде {user}, {server}, {channel}, {args}."
                            value={command.embed_description}
                            onChange={(event) => updateCustomCommand(index, { embed_description: event.target.value })}
                          />
                        </div>
                      </div>
                    )}

                    <div className="section command-custom-section">
                      <div className="inline-row">
                        <h3>Access limits</h3>
                        <span className="badge muted">Optional</span>
                      </div>
                      <div className="form-grid">
                        <div className="field">
                          <label>Allow roles</label>
                          <TagSelector
                            emptyText="Роли не найдены."
                            onChange={(next) => updateCustomCommand(index, { allowed_roles: next })}
                            options={roleOptions}
                            placeholder="Разрешить роли для команды"
                            searchPlaceholder="Найти роль"
                            selected={command.allowed_roles}
                          />
                        </div>
                        <div className="field">
                          <label>Deny roles</label>
                          <TagSelector
                            emptyText="Роли не найдены."
                            onChange={(next) => updateCustomCommand(index, { denied_roles: next })}
                            options={roleOptions}
                            placeholder="Запретить роли для команды"
                            searchPlaceholder="Найти роль"
                            selected={command.denied_roles}
                          />
                        </div>
                        <div className="field">
                          <label>Allow channels</label>
                          <TagSelector
                            emptyText="Каналы не найдены."
                            onChange={(next) => updateCustomCommand(index, { allowed_channels: next })}
                            options={channelOptions}
                            placeholder="Разрешить каналы"
                            searchPlaceholder="Найти канал"
                            selected={command.allowed_channels}
                          />
                        </div>
                        <div className="field">
                          <label>Deny channels</label>
                          <TagSelector
                            emptyText="Каналы не найдены."
                            onChange={(next) => updateCustomCommand(index, { denied_channels: next })}
                            options={channelOptions}
                            placeholder="Запретить каналы"
                            searchPlaceholder="Найти канал"
                            selected={command.denied_channels}
                          />
                        </div>
                      </div>
                    </div>
                  </article>
                ))
              ) : (
                <div className="panel-note">Кастомных команд пока нет. Добавь первую, и она попадёт в базу и в бота.</div>
              )}
            </div>
          </div>

          <button
            className="primary-button"
            onClick={() =>
              save("commands", {
                commandPermissions: commandPermissions.map((permission) => ({
                  ...permission,
                  allow_roles: parseCsv(permission.allow_roles),
                  deny_roles: parseCsv(permission.deny_roles),
                  allow_users: parseCsv(permission.allow_users),
                  deny_users: parseCsv(permission.deny_users),
                  allow_groups: parseCsv(permission.allow_groups),
                  deny_groups: parseCsv(permission.deny_groups),
                  allow_channels: parseCsv(permission.allow_channels),
                  deny_channels: parseCsv(permission.deny_channels),
                })),
                commandGroups: commandGroups.map((group) => ({
                  ...group,
                  roles: parseCsv(group.roles),
                  scopes: parseCsv(group.scopes),
                  color: group.color || null,
                })),
                customCommands: customCommands.map((command) => ({
                  command_name: normalizeCommandName(command.command_name),
                  description: command.description,
                  trigger_type: "prefix",
                  response_mode: command.response_mode,
                  response_text:
                    command.response_mode === "embed" ? command.embed_description : command.response_text,
                  embed:
                    command.response_mode === "embed"
                      ? {
                          title: command.embed_title || null,
                          description: command.embed_description,
                          color: command.embed_color || "#a77cff",
                        }
                      : null,
                  aliases: parseCsv(command.aliases),
                  enabled: command.enabled,
                  cooldown: command.cooldown,
                  allowed_roles: command.allowed_roles,
                  denied_roles: command.denied_roles,
                  allowed_channels: command.allowed_channels,
                  denied_channels: command.denied_channels,
                  meta: {
                    ephemeral: command.ephemeral,
                    delete_trigger: command.delete_trigger,
                  },
                })),
              })
            }
            type="button"
          >
            Save Commands
          </button>
        </section>

        <section
          className={`dashboard-section panel ${activeSection === "moderation" ? "" : "dashboard-section-hidden"}`}
          id="moderation"
        >
          <div className="dashboard-head">
            <div>
              <span className="eyebrow">Moderation</span>
              <h2>Smart filter, logging и правила</h2>
            </div>
            <span className="badge muted">{status.moderation || "Editing locally"}</span>
          </div>

          <div className="form-grid">
            <div className="field">
              <label>Smart filter enabled</label>
              <select
                value={moderation.smartFilterEnabled ? "true" : "false"}
                onChange={(event) =>
                  setModeration({ ...moderation, smartFilterEnabled: event.target.value === "true" })
                }
              >
                <option value="true">Enabled</option>
                <option value="false">Disabled</option>
              </select>
            </div>
            <div className="field">
              <label>Action</label>
              <select
                value={moderation.smartFilterAction}
                onChange={(event) => setModeration({ ...moderation, smartFilterAction: event.target.value })}
              >
                <option value="delete">delete</option>
                <option value="warn">warn</option>
                <option value="mute">mute</option>
                <option value="ban">ban</option>
              </select>
            </div>
            <div className="field">
              <label>Global log channel</label>
              <select
                value={moderation.globalLogChannelId}
                onChange={(event) => setModeration({ ...moderation, globalLogChannelId: event.target.value })}
              >
                <option value="">Not set</option>
                {data.channels.map((channel) => (
                  <option key={channel.channel_id} value={channel.channel_id}>
                    {channel.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Global log color</label>
              <input
                value={moderation.globalLogColor}
                onChange={(event) => setModeration({ ...moderation, globalLogColor: event.target.value })}
              />
            </div>
          </div>

          <div className="form-grid" style={{ marginTop: 16 }}>
            <div className="field">
              <label>Banned words</label>
              <textarea
                value={moderation.bannedWords}
                onChange={(event) => setModeration({ ...moderation, bannedWords: event.target.value })}
              />
            </div>
            <div className="field">
              <label>Regex rules</label>
              <textarea
                value={moderation.regexRules}
                onChange={(event) => setModeration({ ...moderation, regexRules: event.target.value })}
              />
            </div>
          </div>

          <div className="section">
            <div className="inline-row">
              <h3>Guild Rules</h3>
              <button
                className="secondary-button"
                onClick={() =>
                  setModeration((current) => ({
                    ...current,
                    rules: [...current.rules, { title: "", content: "", enabled: true }],
                  }))
                }
                type="button"
              >
                Add rule
              </button>
            </div>
            <div className="stack">
              {moderation.rules.map((rule, index) => (
                <div className="panel-note" key={`rule-${index}`}>
                  <div className="form-grid">
                    <div className="field">
                      <label>Title</label>
                      <input
                        value={rule.title}
                        onChange={(event) =>
                          setModeration((current) => ({
                            ...current,
                            rules: current.rules.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, title: event.target.value } : item,
                            ),
                          }))
                        }
                      />
                    </div>
                    <div className="field">
                      <label>Enabled</label>
                      <select
                        value={rule.enabled ? "true" : "false"}
                        onChange={(event) =>
                          setModeration((current) => ({
                            ...current,
                            rules: current.rules.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, enabled: event.target.value === "true" } : item,
                            ),
                          }))
                        }
                      >
                        <option value="true">Enabled</option>
                        <option value="false">Disabled</option>
                      </select>
                    </div>
                  </div>
                  <div className="field" style={{ marginTop: 12 }}>
                    <label>Content</label>
                    <textarea
                      value={rule.content}
                      onChange={(event) =>
                        setModeration((current) => ({
                          ...current,
                          rules: current.rules.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, content: event.target.value } : item,
                          ),
                        }))
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            className="primary-button"
            onClick={() =>
              save("moderation", {
                ...moderation,
                bannedWords: moderation.bannedWords.split(",").map((item) => item.trim()),
                regexRules: moderation.regexRules.split("\n").map((item) => item.trim()),
                globalLogChannelId: moderation.globalLogChannelId || null,
                globalLogColor: moderation.globalLogColor || null,
              })
            }
            type="button"
          >
            Save Moderation
          </button>
        </section>

        <section
          className={`dashboard-section panel ${activeSection === "tickets" ? "" : "dashboard-section-hidden"}`}
          id="tickets"
        >
          <div className="dashboard-head">
            <div>
              <span className="eyebrow">Tickets</span>
              <h2>Конфиг тикетов и панели</h2>
            </div>
            <span className="badge muted">{status.tickets || "Editing locally"}</span>
          </div>

          <div className="form-grid">
            <div className="field">
              <label>Enabled</label>
              <select
                value={tickets.enabled ? "true" : "false"}
                onChange={(event) => setTickets({ ...tickets, enabled: event.target.value === "true" })}
              >
                <option value="true">Enabled</option>
                <option value="false">Disabled</option>
              </select>
            </div>
            <div className="field">
              <label>Max open per user</label>
              <input
                value={tickets.maxOpenPerUser}
                onChange={(event) => setTickets({ ...tickets, maxOpenPerUser: Number(event.target.value) || 1 })}
              />
            </div>
            <div className="field">
              <label>Default category</label>
              <select
                value={tickets.defaultCategoryId}
                onChange={(event) => setTickets({ ...tickets, defaultCategoryId: event.target.value })}
              >
                <option value="">Not set</option>
                {data.channels.map((channel) => (
                  <option key={channel.channel_id} value={channel.channel_id}>
                    {channel.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Default log channel</label>
              <select
                value={tickets.defaultLogChannelId}
                onChange={(event) => setTickets({ ...tickets, defaultLogChannelId: event.target.value })}
              >
                <option value="">Not set</option>
                {data.channels.map((channel) => (
                  <option key={channel.channel_id} value={channel.channel_id}>
                    {channel.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="section">
            <h3>Support roles</h3>
            <TagSelector
              emptyText="Роли не найдены."
              onChange={(next) => setTickets({ ...tickets, supportRoles: next })}
              options={roleOptions}
              placeholder="Выбери роли поддержки"
              searchPlaceholder="Найти роль"
              selected={tickets.supportRoles}
            />
          </div>

          <div className="section">
            <div className="inline-row">
              <h3>Panels</h3>
              <button
                className="secondary-button"
                onClick={() =>
                  setTickets((current) => ({
                    ...current,
                    panels: [
                      ...current.panels,
                      {
                        panel_key: `panel-${current.panels.length + 1}`,
                        panel_name: "New Panel",
                        panel_channel_id: "",
                        title: "New Ticket Panel",
                        description: "",
                        button_label: "Open ticket",
                        button_style: "primary",
                        emoji: "🎫",
                        category_id: "",
                        log_channel_id: "",
                        ticket_name_template: "ticket-{id}",
                        enabled: true,
                      },
                    ],
                  }))
                }
                type="button"
              >
                Add panel
              </button>
            </div>
            <div className="stack">
              {tickets.panels.map((panel, index) => (
                <div className="panel-note" key={panel.panel_key}>
                  <div className="form-grid">
                    <div className="field">
                      <label>Panel key</label>
                      <input
                        value={panel.panel_key}
                        onChange={(event) =>
                          setTickets((current) => ({
                            ...current,
                            panels: current.panels.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, panel_key: event.target.value } : item,
                            ),
                          }))
                        }
                      />
                    </div>
                    <div className="field">
                      <label>Panel name</label>
                      <input
                        value={panel.panel_name}
                        onChange={(event) =>
                          setTickets((current) => ({
                            ...current,
                            panels: current.panels.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, panel_name: event.target.value } : item,
                            ),
                          }))
                        }
                      />
                    </div>
                  </div>
                  <div className="form-grid">
                    <div className="field">
                      <label>Title</label>
                      <input
                        value={panel.title}
                        onChange={(event) =>
                          setTickets((current) => ({
                            ...current,
                            panels: current.panels.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, title: event.target.value } : item,
                            ),
                          }))
                        }
                      />
                    </div>
                    <div className="field">
                      <label>Button label</label>
                      <input
                        value={panel.button_label}
                        onChange={(event) =>
                          setTickets((current) => ({
                            ...current,
                            panels: current.panels.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, button_label: event.target.value } : item,
                            ),
                          }))
                        }
                      />
                    </div>
                  </div>
                  <div className="field">
                    <label>Description</label>
                    <textarea
                      value={panel.description}
                      onChange={(event) =>
                        setTickets((current) => ({
                          ...current,
                          panels: current.panels.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, description: event.target.value } : item,
                          ),
                        }))
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            className="primary-button"
            onClick={() =>
              save("tickets", {
                ...tickets,
                defaultCategoryId: tickets.defaultCategoryId || null,
                defaultLogChannelId: tickets.defaultLogChannelId || null,
                transcriptChannelId: tickets.transcriptChannelId || null,
                panels: tickets.panels.map((panel) => ({
                  ...panel,
                  panel_channel_id: panel.panel_channel_id || null,
                  category_id: panel.category_id || null,
                  log_channel_id: panel.log_channel_id || null,
                })),
              })
            }
            type="button"
          >
            Save Tickets
          </button>

          <div className="section">
            <h3>Recent tickets</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Status</th>
                  <th>Subject</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {data.recentTickets.length > 0 ? (
                  data.recentTickets.map((ticket) => (
                    <tr key={ticket.id}>
                      <td>{ticket.id}</td>
                      <td>{ticket.status || "open"}</td>
                      <td>{ticket.subject || "—"}</td>
                      <td>{formatDate(ticket.updated_at)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4}>No tickets yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section
          className={`dashboard-section panel ${activeSection === "voice" ? "" : "dashboard-section-hidden"}`}
          id="voice"
        >
          <div className="dashboard-head">
            <div>
              <span className="eyebrow">VoiceMaster</span>
              <h2>Голосовые хабы и управление комнатами</h2>
            </div>
            <span className="badge muted">{status.voice || "Editing locally"}</span>
          </div>

          <div className="form-grid">
            <div className="field">
              <label>Enabled</label>
              <select
                value={voice.enabled ? "true" : "false"}
                onChange={(event) => setVoice({ ...voice, enabled: event.target.value === "true" })}
              >
                <option value="true">Enabled</option>
                <option value="false">Disabled</option>
              </select>
            </div>
            <div className="field">
              <label>Creator channel</label>
              <select
                value={voice.creatorChannelId}
                onChange={(event) => setVoice({ ...voice, creatorChannelId: event.target.value })}
              >
                <option value="">Not set</option>
                {data.channels.map((channel) => (
                  <option key={channel.channel_id} value={channel.channel_id}>
                    {channel.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Category</label>
              <select value={voice.categoryId} onChange={(event) => setVoice({ ...voice, categoryId: event.target.value })}>
                <option value="">Not set</option>
                {data.channels.map((channel) => (
                  <option key={channel.channel_id} value={channel.channel_id}>
                    {channel.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Log channel</label>
              <select value={voice.logChannelId} onChange={(event) => setVoice({ ...voice, logChannelId: event.target.value })}>
                <option value="">Not set</option>
                {data.channels.map((channel) => (
                  <option key={channel.channel_id} value={channel.channel_id}>
                    {channel.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Room template</label>
              <input value={voice.roomNameTemplate} onChange={(event) => setVoice({ ...voice, roomNameTemplate: event.target.value })} />
            </div>
            <div className="field">
              <label>Default user limit</label>
              <input value={voice.defaultUserLimit} onChange={(event) => setVoice({ ...voice, defaultUserLimit: Number(event.target.value) || 0 })} />
            </div>
          </div>

          <div className="module-card-grid" style={{ marginTop: 18 }}>
            {voiceToggleCards.map((item) => (
              <button
                aria-pressed={voice[item.key]}
                className={`module-toggle-card ${voice[item.key] ? "module-toggle-card-active" : ""}`}
                key={item.key}
                onClick={() => setVoice({ ...voice, [item.key]: !voice[item.key] })}
                type="button"
              >
                <div className="module-toggle-top">
                  <span className="module-toggle-state">{voice[item.key] ? "Enabled" : "Disabled"}</span>
                  <span className={`module-toggle-knob ${voice[item.key] ? "module-toggle-knob-active" : ""}`}>
                    <span />
                  </span>
                </div>
                <strong>{item.title}</strong>
                <p>{item.description}</p>
              </button>
            ))}
          </div>

          <div className="field" style={{ marginTop: 16 }}>
            <label>Hubs JSON</label>
            <textarea value={voice.hubs} onChange={(event) => setVoice({ ...voice, hubs: event.target.value })} />
          </div>

          <button
            className="primary-button"
            onClick={() =>
              save("voice", {
                ...voice,
                creatorChannelId: voice.creatorChannelId || null,
                categoryId: voice.categoryId || null,
                logChannelId: voice.logChannelId || null,
                hubs: safeJsonParse<Record<string, unknown>>(voice.hubs, {}),
              })
            }
            type="button"
          >
            Save VoiceMaster
          </button>

          <div className="section">
            <h3>Tracked rooms</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Room</th>
                  <th>Owner</th>
                  <th>Members</th>
                  <th>Locked</th>
                </tr>
              </thead>
              <tbody>
                {data.voicemasterRooms.length > 0 ? (
                  data.voicemasterRooms.map((room) => (
                    <tr key={room.channel_id}>
                      <td>{room.name || room.channel_id}</td>
                      <td>{room.owner_id || "—"}</td>
                      <td>{room.member_count || 0}</td>
                      <td>{room.locked ? "Yes" : "No"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4}>No tracked temp rooms.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section
          className={`dashboard-section panel ${activeSection === "branding" ? "" : "dashboard-section-hidden"}`}
          id="branding"
        >
          <div className="dashboard-head">
            <div>
              <span className="eyebrow">Branding</span>
              <h2>Embeds, webhooks и server panel</h2>
            </div>
            <span className="badge muted">{status.branding || "Editing locally"}</span>
          </div>

          <div className="form-grid">
            <div className="field">
              <label>Embed color</label>
              <input value={branding.embedColor} onChange={(event) => setBranding({ ...branding, embedColor: event.target.value })} />
            </div>
            <div className="field">
              <label>Footer text</label>
              <input value={branding.footerText} onChange={(event) => setBranding({ ...branding, footerText: event.target.value })} />
            </div>
            <div className="field">
              <label>Footer icon URL</label>
              <input value={branding.footerIconUrl} onChange={(event) => setBranding({ ...branding, footerIconUrl: event.target.value })} />
            </div>
            <div className="field">
              <label>Banner URL</label>
              <input value={branding.bannerUrl} onChange={(event) => setBranding({ ...branding, bannerUrl: event.target.value })} />
            </div>
            <div className="field">
              <label>Webhook name</label>
              <input value={branding.webhookName} onChange={(event) => setBranding({ ...branding, webhookName: event.target.value })} />
            </div>
            <div className="field">
              <label>Webhook avatar URL</label>
              <input value={branding.webhookAvatarUrl} onChange={(event) => setBranding({ ...branding, webhookAvatarUrl: event.target.value })} />
            </div>
            <div className="field">
              <label>Server panel enabled</label>
              <select
                value={branding.panelEnabled ? "true" : "false"}
                onChange={(event) => setBranding({ ...branding, panelEnabled: event.target.value === "true" })}
              >
                <option value="true">Enabled</option>
                <option value="false">Disabled</option>
              </select>
            </div>
            <div className="field">
              <label>Server panel channel</label>
              <select
                value={branding.panelChannelId}
                onChange={(event) => setBranding({ ...branding, panelChannelId: event.target.value })}
              >
                <option value="">Not set</option>
                {data.channels.map((channel) => (
                  <option key={channel.channel_id} value={channel.channel_id}>
                    {channel.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            className="primary-button"
            onClick={() =>
              save("branding", {
                ...branding,
                footerIconUrl: branding.footerIconUrl || null,
                webhookAvatarUrl: branding.webhookAvatarUrl || null,
                bannerUrl: branding.bannerUrl || null,
                panelChannelId: branding.panelChannelId || null,
              })
            }
            type="button"
          >
            Save Branding
          </button>
        </section>

        <section
          className={`dashboard-section panel ${activeSection === "premium" ? "" : "dashboard-section-hidden"}`}
          id="premium"
        >
          <div className="dashboard-head">
            <div>
              <span className="eyebrow">Premium</span>
              <h2>Premium-функции сервера</h2>
            </div>
            <span className={`badge ${premium.premiumActive ? "success" : "warn"}`}>
              {premium.premiumActive ? "Premium active" : "Free tier"}
            </span>
          </div>

          <span className="badge muted">{status.premium || "Editing locally"}</span>

          {!hasPremiumAccess ? (
            <div className="panel-note premium-locked-note">
              Premium-настройки недоступны для сохранения, пока для этого сервера не активирован premium-доступ.
            </div>
          ) : null}

          <fieldset className="premium-fieldset" disabled={!hasPremiumAccess}>
          <div className="form-grid" style={{ marginTop: 18 }}>
            <div className="field">
              <label>Premium access</label>
              <select
                value={premium.premiumActive ? "true" : "false"}
                disabled
                onChange={() => {}}
              >
                <option value="true">Enabled</option>
                <option value="false">Disabled</option>
              </select>
            </div>
            <div className="field">
              <label>Plan name</label>
              <input value={premium.planName} onChange={(event) => setPremium({ ...premium, planName: event.target.value })} />
            </div>
          </div>

          <div className="section">
            <h3>Enabled features</h3>
            <div className="module-card-grid premium-module-grid">
              {premiumFeatureOptions.map((feature) => (
                <button
                  aria-pressed={premium.features.includes(feature.key)}
                  className={`module-toggle-card ${premium.features.includes(feature.key) ? "module-toggle-card-active" : ""}`}
                  key={feature.key}
                  onClick={() =>
                    setPremium({
                      ...premium,
                      features: toggleValue(premium.features, feature.key),
                    })
                  }
                  type="button"
                >
                  <div className="module-toggle-top">
                    <span className="module-toggle-state">
                      {premium.features.includes(feature.key) ? "Enabled" : "Disabled"}
                    </span>
                    <span className={`module-toggle-knob ${premium.features.includes(feature.key) ? "module-toggle-knob-active" : ""}`}>
                      <span />
                    </span>
                  </div>
                  <strong>{feature.label}</strong>
                  <p>{feature.description}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="section">
            <h3>Brand Role</h3>
            <div className="form-grid">
              <div className="field">
                <label>Role name</label>
                <input
                  value={premium.brandRoleName}
                  onChange={(event) => setPremium({ ...premium, brandRoleName: event.target.value })}
                />
              </div>
              <div className="field">
                <label>Role color</label>
                <input
                  value={premium.brandRoleColor}
                  onChange={(event) => setPremium({ ...premium, brandRoleColor: event.target.value })}
                />
              </div>
            </div>
            <div className="module-card-grid" style={{ marginTop: 14 }}>
              {premiumBrandToggleCards.map((item) => (
                <button
                  aria-pressed={premium[item.key]}
                  className={`module-toggle-card ${premium[item.key] ? "module-toggle-card-active" : ""}`}
                  key={item.key}
                  onClick={() => setPremium({ ...premium, [item.key]: !premium[item.key] })}
                  type="button"
                >
                  <div className="module-toggle-top">
                    <span className="module-toggle-state">{premium[item.key] ? "Enabled" : "Disabled"}</span>
                    <span className={`module-toggle-knob ${premium[item.key] ? "module-toggle-knob-active" : ""}`}>
                      <span />
                    </span>
                  </div>
                  <strong>{item.title}</strong>
                  <p>{item.description}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="section">
            <h3>Server Panel Customization</h3>
            <div className="form-grid">
              <div className="field">
                <label>Title</label>
                <input
                  value={premium.serverPanelTitle}
                  onChange={(event) => setPremium({ ...premium, serverPanelTitle: event.target.value })}
                />
              </div>
              <div className="field">
                <label>Footer</label>
                <input
                  value={premium.serverPanelFooter}
                  onChange={(event) => setPremium({ ...premium, serverPanelFooter: event.target.value })}
                />
              </div>
            </div>
            <div className="field">
              <label>Description</label>
              <textarea
                value={premium.serverPanelDescription}
                onChange={(event) => setPremium({ ...premium, serverPanelDescription: event.target.value })}
              />
            </div>
          </div>

          <div className="section">
            <h3>Welcome / Leave Branding</h3>
            <div className="form-grid">
              <div className="field">
                <label>Welcome channel</label>
                <select
                  value={premium.welcomeChannelId}
                  onChange={(event) => setPremium({ ...premium, welcomeChannelId: event.target.value })}
                >
                  <option value="">Not set</option>
                  {data.channels.map((channel) => (
                    <option key={`welcome-${channel.channel_id}`} value={channel.channel_id}>
                      {channel.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Leave channel</label>
                <select
                  value={premium.leaveChannelId}
                  onChange={(event) => setPremium({ ...premium, leaveChannelId: event.target.value })}
                >
                  <option value="">Not set</option>
                  {data.channels.map((channel) => (
                    <option key={`leave-${channel.channel_id}`} value={channel.channel_id}>
                      {channel.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="module-card-grid premium-module-grid" style={{ marginTop: 14 }}>
              {premiumWelcomeToggleCards.map((item) => (
                <button
                  aria-pressed={premium[item.key]}
                  className={`module-toggle-card ${premium[item.key] ? "module-toggle-card-active" : ""}`}
                  key={item.key}
                  onClick={() => setPremium({ ...premium, [item.key]: !premium[item.key] })}
                  type="button"
                >
                  <div className="module-toggle-top">
                    <span className="module-toggle-state">{premium[item.key] ? "Enabled" : "Disabled"}</span>
                    <span className={`module-toggle-knob ${premium[item.key] ? "module-toggle-knob-active" : ""}`}>
                      <span />
                    </span>
                  </div>
                  <strong>{item.title}</strong>
                  <p>{item.description}</p>
                </button>
              ))}
            </div>
            <div className="form-grid" style={{ marginTop: 14 }}>
              <div className="field">
                <label>Welcome title</label>
                <input
                  value={premium.welcomeTitle}
                  onChange={(event) => setPremium({ ...premium, welcomeTitle: event.target.value })}
                />
              </div>
              <div className="field">
                <label>Leave title</label>
                <input
                  value={premium.leaveTitle}
                  onChange={(event) => setPremium({ ...premium, leaveTitle: event.target.value })}
                />
              </div>
            </div>
            <div className="form-grid">
              <div className="field">
                <label>Welcome message</label>
                <textarea
                  value={premium.welcomeMessage}
                  onChange={(event) => setPremium({ ...premium, welcomeMessage: event.target.value })}
                />
              </div>
              <div className="field">
                <label>Leave message</label>
                <textarea
                  value={premium.leaveMessage}
                  onChange={(event) => setPremium({ ...premium, leaveMessage: event.target.value })}
                />
              </div>
            </div>
            <div className="field">
              <label>Welcome DM message</label>
              <textarea
                value={premium.dmMessage}
                onChange={(event) => setPremium({ ...premium, dmMessage: event.target.value })}
              />
            </div>
          </div>

          <div className="section">
            <h3>Analytics Pro</h3>
            <div className="grid-2">
              <div className="panel-note">Всего событий: {data.premiumAnalytics.totalEvents}</div>
              <div className="panel-note">Команд: {data.premiumAnalytics.commandCount}</div>
              <div className="panel-note">Заходов участников: {data.premiumAnalytics.memberJoinCount}</div>
              <div className="panel-note">Выходов участников: {data.premiumAnalytics.memberLeaveCount}</div>
            </div>
            <div className="grid-2" style={{ marginTop: 14 }}>
              <div className="panel-note">
                <strong>Top commands</strong>
                <br />
                {data.premiumAnalytics.topCommands.length > 0
                  ? data.premiumAnalytics.topCommands.map((item) => `${item.command}: ${item.count}`).join(" | ")
                  : "No data yet."}
              </div>
              <div className="panel-note">
                <strong>Top event types</strong>
                <br />
                {data.premiumAnalytics.recentEventTypes.length > 0
                  ? data.premiumAnalytics.recentEventTypes.map((item) => `${item.eventType}: ${item.count}`).join(" | ")
                  : "No data yet."}
              </div>
            </div>
          </div>

          <button
            className="primary-button"
            onClick={() =>
              save("premium", {
                premiumActive: premium.premiumActive,
                planName: premium.planName,
                features: premium.features,
                brandRole: {
                  role_name: premium.brandRoleName,
                  color: premium.brandRoleColor,
                  hoist: premium.brandRoleHoist,
                  mentionable: premium.brandRoleMentionable,
                },
                serverPanelSettings: {
                  title: premium.serverPanelTitle,
                  description: premium.serverPanelDescription,
                  footer: premium.serverPanelFooter,
                },
                welcomeSettings: {
                  welcome_enabled: premium.welcomeEnabled,
                  welcome_channel_id: premium.welcomeChannelId || null,
                  welcome_title: premium.welcomeTitle,
                  welcome_message: premium.welcomeMessage,
                  leave_enabled: premium.leaveEnabled,
                  leave_channel_id: premium.leaveChannelId || null,
                  leave_title: premium.leaveTitle,
                  leave_message: premium.leaveMessage,
                  send_dm: premium.sendDm,
                  dm_message: premium.dmMessage,
                },
                analyticsSettings: {
                  expose_dashboard: true,
                },
              })
            }
            type="button"
          >
            Save Premium
          </button>
          </fieldset>
        </section>
      </div>
    </div>
  );
}
