"use client";

import { useMemo, useState } from "react";

export type ScDashboardSection = "settings" | "attendance" | "tabs" | "logs";

type Props = {
  guildId: string;
  data: any;
  activeSection: ScDashboardSection;
};

const roleKeys = [
  ["verified", "SC Verified"],
  ["cw_participant", "КВ: Участвует"],
  ["leader", "SC Лидер"],
  ["colonel", "SC Полковник"],
  ["officer", "SC Офицер"],
] as const;

const navItems: Array<[ScDashboardSection, string, string]> = [
  ["settings", "Настройки", "settings"],
  ["attendance", "Посещения", "attendance"],
  ["tabs", "Табы КВ", "cw-tabs"],
  ["logs", "SC логи", "logs"],
];

function toInt(value: string) {
  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseResultRows(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [character_name, kills, deaths, assists, treasury_spent, score] = line.split(/[;,]/).map((item) => item.trim());
      return {
        character_name,
        kills: toInt(kills || "0"),
        deaths: toInt(deaths || "0"),
        assists: toInt(assists || "0"),
        treasury_spent: toInt(treasury_spent || "0"),
        score: toInt(score || "0"),
      };
    })
    .filter((row) => row.character_name);
}

function uniqueClanOptions(characters: any[]) {
  const byKey = new Map<string, { key: string; clan_id: string | null; clan_name: string; region: string | null; character_name: string }>();

  for (const character of characters || []) {
    const clanName = String(character.clan_name || "").trim();
    if (!clanName) continue;
    const clanId = character.clan_id ? String(character.clan_id) : null;
    const region = character.region ? String(character.region) : null;
    const key = `${region || "ANY"}:${clanId || clanName}`;
    if (!byKey.has(key)) {
      byKey.set(key, {
        key,
        clan_id: clanId,
        clan_name: clanName,
        region,
        character_name: character.character_name || "персонаж",
      });
    }
  }

  return [...byKey.values()].sort((a, b) => a.clan_name.localeCompare(b.clan_name, "ru"));
}

export function ScGuildDashboardClient({ guildId, data, activeSection }: Props) {
  const [status, setStatus] = useState("");
  const [resultText, setResultText] = useState("");
  const clanOptions = useMemo(() => uniqueClanOptions(data.userCharacters || []), [data.userCharacters]);
  const initialClanKey = clanOptions.find((clan) => clan.clan_id && clan.clan_id === data.settings?.clan_id)?.key || "";
  const [settings, setSettings] = useState({
    community_name: data.settings?.community_name || data.guild?.name || "",
    clan_id: data.settings?.clan_id || data.settings?.required_clan_id || "",
    clan_name: data.settings?.clan_name || data.settings?.required_clan_name || "",
    clan_key: initialClanKey,
    region: data.settings?.region || "",
    cw_post_channel_id: data.settings?.cw_post_channel_id || "",
    absence_channel_id: data.settings?.absence_channel_id || "",
    results_channel_id: data.settings?.results_channel_id || "",
    emission_channel_id: data.settings?.emission_channel_id || "",
    logs_channel_id: data.settings?.logs_channel_id || "",
    sc_commands_channel_id: data.settings?.sc_commands_channel_id || "",
    auto_create_roles: data.settings?.auto_create_roles ?? true,
  });
  const [roles, setRoles] = useState(() =>
    roleKeys.map(([role_key, defaultName]) => {
      const current = data.scRoles?.find((role: any) => role.role_key === role_key);
      return {
        role_key,
        role_id: current?.role_id || "",
        role_name: current?.role_name || defaultName,
      };
    }),
  );

  const channelOptions = data.channels || [];
  const roleOptions = data.discordRoles || [];
  const attendanceSummary = useMemo(() => {
    const rows = data.attendance || [];
    return {
      attending: rows.filter((row: any) => row.status === "attending").length,
      absent: rows.filter((row: any) => row.status === "absent").length,
      total: rows.length,
    };
  }, [data.attendance]);

  function selectClan(key: string) {
    const clan = clanOptions.find((item) => item.key === key);
    if (!clan) {
      setSettings({ ...settings, clan_key: "", clan_id: "", clan_name: "" });
      return;
    }

    setSettings({
      ...settings,
      clan_key: key,
      clan_id: clan.clan_id || "",
      clan_name: clan.clan_name,
      community_name: settings.community_name || clan.clan_name,
      region: settings.region || clan.region || "",
    });
  }

  async function saveSettings() {
    setStatus("Сохраняю...");
    const response = await fetch(`/api/sc/guilds/${guildId}/settings`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...settings,
        clan_key: undefined,
        clan_id: settings.clan_id || null,
        clan_name: settings.clan_name || null,
        community_name: settings.community_name || null,
        region: settings.region || null,
        cw_post_channel_id: settings.cw_post_channel_id || null,
        absence_channel_id: settings.absence_channel_id || null,
        results_channel_id: settings.results_channel_id || null,
        emission_channel_id: settings.emission_channel_id || null,
        logs_channel_id: settings.logs_channel_id || null,
        sc_commands_channel_id: settings.sc_commands_channel_id || null,
        roles: roles.map((role) => ({
          ...role,
          role_id: role.role_id || null,
          role_name: role.role_name || null,
        })),
      }),
    });
    const body = await response.json().catch(() => ({}));
    setStatus(response.ok ? "Сохранено." : body.error || "Ошибка сохранения.");
  }

  async function uploadResults() {
    const rows = parseResultRows(resultText);
    if (!rows.length) {
      setStatus("Строки табов не найдены.");
      return;
    }
    setStatus("Загружаю табы...");
    const response = await fetch(`/api/sc/guilds/${guildId}/cw-results`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ rows }),
    });
    const body = await response.json().catch(() => ({}));
    setStatus(response.ok ? `Загружено строк: ${body.count || rows.length}.` : body.error || "Ошибка загрузки.");
    if (response.ok) setResultText("");
  }

  return (
    <div className="dashboard-grid sc-dashboard-grid">
      <aside className="dashboard-sidebar panel sc-dashboard-sidebar">
        <span className="eyebrow sc-eyebrow">STALCRAFT</span>
        <div className="sidebar-links">
          {navItems.map(([key, label, slug]) => (
            <a className={activeSection === key ? "sidebar-link-active" : ""} href={`/dashboard/${guildId}/${slug}`} key={key}>
              {label}
            </a>
          ))}
        </div>
        <div className="panel-note">
          <strong>КВ:</strong> пост в 14:00 МСК, старт в 20:00 МСК.
        </div>
      </aside>

      <div className="dashboard-sections">
        {activeSection === "settings" ? (
          <section className="dashboard-section panel sc-dashboard-section">
            <div className="dashboard-head">
              <div>
                <span className="eyebrow sc-eyebrow">Clan Operations</span>
                <h2>Настройки STALCRAFT клана</h2>
              </div>
              <span className="badge muted">{status || "Editing locally"}</span>
            </div>

            <div className="form-grid">
              <div className="field">
                <label>Название комьюнити</label>
                <input value={settings.community_name} onChange={(event) => setSettings({ ...settings, community_name: event.target.value })} />
              </div>
              <div className="field">
                <label>Клан из твоих персонажей</label>
                <select value={settings.clan_key} onChange={(event) => selectClan(event.target.value)}>
                  <option value="">Не выбран</option>
                  {clanOptions.map((clan) => (
                    <option key={clan.key} value={clan.key}>
                      [{clan.region || "SC"}] {clan.clan_name} · {clan.character_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Clan name</label>
                <input readOnly value={settings.clan_name} placeholder="Выбери клан выше" />
              </div>
              <div className="field">
                <label>Регион</label>
                <select value={settings.region} onChange={(event) => setSettings({ ...settings, region: event.target.value })}>
                  <option value="">Не задавать</option>
                  <option value="RU">RU</option>
                  <option value="EU">EU</option>
                  <option value="NA">NA</option>
                  <option value="SEA">SEA</option>
                </select>
              </div>
            </div>

            {clanOptions.length === 0 ? (
              <div className="panel-note sc-panel-warning">
                Сайт пока не видит кланы на твоих персонажах. Открой страницу STALCRAFT, нажми “Обновить персонажей” и выбери персонажа.
              </div>
            ) : null}

            <div className="section sc-inner-section">
              <h3>Каналы Discord</h3>
              <div className="form-grid">
                {[
                  ["cw_post_channel_id", "КВ-пост"],
                  ["absence_channel_id", "Отсутствия"],
                  ["results_channel_id", "Итоги"],
                  ["emission_channel_id", "Выбросы"],
                  ["logs_channel_id", "Логи Discord"],
                  ["sc_commands_channel_id", "sc-x-команды"],
                ].map(([key, label]) => (
                  <div className="field" key={key}>
                    <label>{label}</label>
                    <select value={(settings as any)[key]} onChange={(event) => setSettings({ ...settings, [key]: event.target.value } as any)}>
                      <option value="">Не выбран</option>
                      {channelOptions.map((channel: any) => (
                        <option key={`${key}-${channel.channel_id}`} value={channel.channel_id}>
                          # {channel.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            <div className="section sc-inner-section">
              <h3>Роли</h3>
              <div className="form-grid">
                {roles.map((role, index) => (
                  <div className="field" key={role.role_key}>
                    <label>{role.role_name}</label>
                    <select
                      value={role.role_id}
                      onChange={(event) =>
                        setRoles((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, role_id: event.target.value } : item))
                      }
                    >
                      <option value="">Авто / не выбрана</option>
                      {roleOptions.map((discordRole: any) => (
                        <option key={`${role.role_key}-${discordRole.role_id}`} value={discordRole.role_id}>
                          {discordRole.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            <button className="primary-button sc-primary" onClick={saveSettings} type="button">Сохранить настройки</button>
          </section>
        ) : null}

        {activeSection === "attendance" ? (
          <section className="dashboard-section panel sc-dashboard-section">
            <div className="dashboard-head">
              <div>
                <span className="eyebrow sc-eyebrow">CW Attendance</span>
                <h2>Посещения и отсутствия</h2>
              </div>
              <span className="badge success">Участвуют {attendanceSummary.attending} / Отсутствуют {attendanceSummary.absent}</span>
            </div>
            <div className="activity-feed-grid">
              {(data.attendance || []).map((row: any) => (
                <article className="activity-card" key={row.id}>
                  <div className="activity-card-head">
                    <span className={`badge ${row.status === "attending" ? "success" : "warn"}`}>{row.status}</span>
                    <span className="activity-time">{row.responded_at || "—"}</span>
                  </div>
                  <strong>{row.character_name || row.discord_user_id}</strong>
                  <p>{row.absence_type ? `${row.absence_type}: ${row.absence_reason || "без причины"}` : "Готов к КВ"}</p>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {activeSection === "tabs" ? (
          <section className="dashboard-section panel sc-dashboard-section">
            <div className="dashboard-head">
              <div>
                <span className="eyebrow sc-eyebrow">CW Tabs</span>
                <h2>Очередь итогов КВ</h2>
              </div>
              <span className="badge muted">{(data.resultQueue || []).length} row(s)</span>
            </div>
            <div className="panel-note">
              Формат строки: <code>ник;kills;deaths;assists;казна;счёт</code>. После команды `/sc-cw publish-results`
              бот отправит итог в Discord и удалит эти строки из Supabase.
            </div>
            <div className="field">
              <label>Добавить табы</label>
              <textarea value={resultText} onChange={(event) => setResultText(event.target.value)} placeholder="PlayerOne;12;3;5;1000;320" />
            </div>
            <button className="primary-button sc-primary" onClick={uploadResults} type="button">Загрузить табы</button>

            <div className="activity-feed-grid" style={{ marginTop: 18 }}>
              {(data.resultQueue || []).map((row: any) => (
                <article className="activity-card" key={row.id}>
                  <strong>{row.character_name}</strong>
                  <p>K/D/A {row.kills}/{row.deaths}/{row.assists} · Казна {row.treasury_spent} · Счёт {row.score}</p>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {activeSection === "logs" ? (
          <section className="dashboard-section panel sc-dashboard-section">
            <div className="dashboard-head">
              <div>
                <span className="eyebrow sc-eyebrow">Discord logs</span>
                <h2>SC логи публикуются только в Discord</h2>
              </div>
              <span className="badge muted">{status || "канал логов"}</span>
            </div>
            <p className="muted">
              Сайт не показывает журнал логов отдельной лентой. Выбери Discord-канал, и бот будет отправлять туда события:
              привязки игроков, изменения настроек, КВ, табы, выбросы и системные действия.
            </p>
            <div className="field">
              <label>Канал логов Discord</label>
              <select value={settings.logs_channel_id} onChange={(event) => setSettings({ ...settings, logs_channel_id: event.target.value })}>
                <option value="">Не выбран</option>
                {channelOptions.map((channel: any) => (
                  <option key={`logs-${channel.channel_id}`} value={channel.channel_id}>
                    # {channel.name}
                  </option>
                ))}
              </select>
            </div>
            <button className="primary-button sc-primary" onClick={saveSettings} type="button">Сохранить канал логов</button>
          </section>
        ) : null}
      </div>
    </div>
  );
}
