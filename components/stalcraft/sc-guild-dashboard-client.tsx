"use client";

import { useMemo, useState } from "react";

type Props = {
  guildId: string;
  data: any;
};

const roleKeys = [
  ["verified", "SC Verified"],
  ["cw_participant", "КВ: Участвует"],
  ["leader", "SC Лидер"],
  ["colonel", "SC Полковник"],
  ["officer", "SC Офицер"],
] as const;

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

export function ScGuildDashboardClient({ guildId, data }: Props) {
  const [status, setStatus] = useState("");
  const [resultText, setResultText] = useState("");
  const [settings, setSettings] = useState({
    community_name: data.settings?.community_name || data.guild?.name || "",
    clan_id: data.settings?.clan_id || data.settings?.required_clan_id || "",
    clan_name: data.settings?.clan_name || data.settings?.required_clan_name || "",
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

  async function saveSettings() {
    setStatus("Saving settings...");
    const response = await fetch(`/api/sc/guilds/${guildId}/settings`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...settings,
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
    setStatus(response.ok ? "Settings saved." : body.error || "Save failed.");
  }

  async function uploadResults() {
    const rows = parseResultRows(resultText);
    if (!rows.length) {
      setStatus("No result rows found.");
      return;
    }
    setStatus("Uploading CW tabs...");
    const response = await fetch(`/api/sc/guilds/${guildId}/cw-results`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ rows }),
    });
    const body = await response.json().catch(() => ({}));
    setStatus(response.ok ? `Uploaded ${body.count || rows.length} row(s).` : body.error || "Upload failed.");
    if (response.ok) setResultText("");
  }

  return (
    <div className="dashboard-grid">
      <aside className="dashboard-sidebar panel">
        <span className="eyebrow">STALCRAFT</span>
        <div className="sidebar-links">
          <a className="sidebar-link-active" href="#settings">Настройки</a>
          <a href="#attendance">Посещения</a>
          <a href="#tabs">Табы КВ</a>
          <a href="#logs">SC логи</a>
        </div>
        <div className="panel-note">
          <strong>КВ:</strong> пост в 14:00 МСК, старт в 20:00 МСК.
        </div>
      </aside>

      <div className="dashboard-sections">
        <section className="dashboard-section panel" id="settings">
          <div className="dashboard-head">
            <div>
              <span className="eyebrow">Clan Operations</span>
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
              <label>Clan ID</label>
              <input value={settings.clan_id} onChange={(event) => setSettings({ ...settings, clan_id: event.target.value })} />
            </div>
            <div className="field">
              <label>Clan name</label>
              <input value={settings.clan_name} onChange={(event) => setSettings({ ...settings, clan_name: event.target.value })} />
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

          <div className="section">
            <h3>Каналы</h3>
            <div className="form-grid">
              {[
                ["cw_post_channel_id", "КВ-пост"],
                ["absence_channel_id", "Отсутствия"],
                ["results_channel_id", "Итоги"],
                ["emission_channel_id", "Выбросы"],
                ["logs_channel_id", "Логи"],
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

          <div className="section">
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

          <button className="primary-button" onClick={saveSettings} type="button">Save STALCRAFT Settings</button>
        </section>

        <section className="dashboard-section panel" id="attendance">
          <div className="dashboard-head">
            <div>
              <span className="eyebrow">CW Attendance</span>
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

        <section className="dashboard-section panel" id="tabs">
          <div className="dashboard-head">
            <div>
              <span className="eyebrow">CW Tabs</span>
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
          <button className="primary-button" onClick={uploadResults} type="button">Upload CW Tabs</button>

          <div className="activity-feed-grid" style={{ marginTop: 18 }}>
            {(data.resultQueue || []).map((row: any) => (
              <article className="activity-card" key={row.id}>
                <strong>{row.character_name}</strong>
                <p>K/D/A {row.kills}/{row.deaths}/{row.assists} · Казна {row.treasury_spent} · Счёт {row.score}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="dashboard-section panel" id="logs">
          <div className="dashboard-head">
            <div>
              <span className="eyebrow">STALCRAFT Logs</span>
              <h2>Только события по СК</h2>
            </div>
            <span className="badge muted">{(data.logs || []).length} latest</span>
          </div>
          <div className="activity-feed-grid">
            {(data.logs || []).map((log: any) => (
              <article className="activity-card" key={log.id}>
                <div className="activity-card-head">
                  <span className="badge muted">{log.event_type}</span>
                  <span className="activity-time">{log.created_at}</span>
                </div>
                <strong>{log.title || log.event_type}</strong>
                <p>{log.message || "—"}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
