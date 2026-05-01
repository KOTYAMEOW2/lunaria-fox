"use client";

import { useMemo, useState } from "react";

export type ScDashboardSection = "settings" | "attendance" | "tabs";

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
];

type CwResultRow = {
  character_name: string;
  matches_count: number;
  kills: number;
  deaths: number;
  assists: number;
  treasury_spent: number;
  score: number;
};

function toInt(value: string | number | null | undefined) {
  const parsed = Number.parseInt(String(value ?? "0").replace(/[^\d-]/g, ""), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseManualResultRows(value: string): CwResultRow[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/[;,]/).map((item) => item.trim());
      const [character_name] = parts;
      const hasMatches = parts.length >= 7;
      const [matches_count, kills, deaths, assists, treasury_spent, score] = hasMatches
        ? parts.slice(1)
        : ["1", ...parts.slice(1)];
      return {
        character_name,
        matches_count: Math.max(1, toInt(matches_count || "1")),
        kills: toInt(kills || "0"),
        deaths: toInt(deaths || "0"),
        assists: toInt(assists || "0"),
        treasury_spent: toInt(treasury_spent || "0"),
        score: toInt(score || "0"),
      };
    })
    .filter((row) => row.character_name);
}

function parseFloatStat(value: string | undefined) {
  if (!value) return null;
  const parsed = Number.parseFloat(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function isGroupedInteger(parts: string[]) {
  return parts.every((part, index) => /^\d+$/.test(part) && (index === 0 ? part.length <= 3 : part.length === 3));
}

function groupedInt(parts: string[]) {
  return toInt(parts.join(""));
}

function buildPartitions(tokens: string[], groupsLeft: number, maxGroupSize: number): string[][][] {
  if (groupsLeft === 0) return tokens.length === 0 ? [[]] : [];
  const minRemaining = groupsLeft - 1;
  const maxSize = Math.min(maxGroupSize, tokens.length - minRemaining);
  const result: string[][][] = [];

  for (let size = 1; size <= maxSize; size += 1) {
    const group = tokens.slice(0, size);
    if (!isGroupedInteger(group)) continue;
    for (const tail of buildPartitions(tokens.slice(size), groupsLeft - 1, maxGroupSize)) {
      result.push([group, ...tail]);
    }
  }

  return result;
}

function scoreOcrCandidate(values: number[], kd: number | null, kda: number | null) {
  const [matches, kills, deaths, assists, treasury, score] = values;
  let penalty = 0;

  if (matches < 0 || matches > 10000) penalty += 500;
  if (kills > 100000 || deaths > 100000 || assists > 100000) penalty += 250;
  if (treasury > 999999999 || score > 999999999) penalty += 250;

  if (kd !== null) {
    const current = deaths === 0 ? (kills > 0 ? 99 : 0) : kills / deaths;
    penalty += Math.abs(Math.min(current, 99) - kd) * 30;
  }

  if (kda !== null) {
    const current = deaths === 0 ? (kills + assists > 0 ? 99 : 0) : (kills + assists) / deaths;
    penalty += Math.abs(Math.min(current, 99) - kda) * 20;
  }

  return penalty;
}

function parseOcrNumbers(rawNumbers: string[]) {
  const decimalTail = rawNumbers.filter((token) => /[,.]/.test(token)).slice(-2);
  const kd = parseFloatStat(decimalTail[0]);
  const kda = parseFloatStat(decimalTail[1]);
  const integerTokens = rawNumbers.filter((token) => !/[,.]/.test(token));

  if (integerTokens.length < 6) return null;

  const partitionCandidates = buildPartitions(integerTokens, 6, 3)
    .map((partition) => partition.map(groupedInt))
    .map((values) => ({
      values,
      score: scoreOcrCandidate(values, kd, kda),
    }))
    .sort((a, b) => a.score - b.score);

  const best = partitionCandidates[0]?.values;
  if (!best) return null;

  return {
    matches_count: Math.max(1, best[0] || 1),
    kills: best[1] || 0,
    deaths: best[2] || 0,
    assists: best[3] || 0,
    treasury_spent: best[4] || 0,
    score: best[5] || 0,
  };
}

function parseOcrResultRows(value: string): CwResultRow[] {
  const ignored = /^(ник|игрок|player|name|kills?|убийств|смерт|death|assist|казна|score|счет|счёт|k\/d)/i;

  return value
    .split("\n")
    .map((line) => line.replace(/[|¦]/g, " ").trim())
    .filter((line) => line.length > 3 && !ignored.test(line))
    .map((line) => {
      const numericMatches = [...line.matchAll(/\d+(?:[,.]\d+)?/g)];
      if (numericMatches.length < 6) return null;

      const firstNumberIndex = numericMatches[0]?.index ?? line.length;
      const character_name = line
        .slice(0, firstNumberIndex)
        .replace(/[^\p{L}\p{N}\s_[\].#-]/gu, " ")
        .replace(/\s+/g, " ")
        .trim();

      if (!character_name || character_name.length < 2) return null;

      const parsed = parseOcrNumbers(numericMatches.map((match) => match[0]));
      if (!parsed) return null;

      return {
        character_name,
        ...parsed,
      };
    })
    .filter(Boolean) as CwResultRow[];
}

function rowsToText(rows: CwResultRow[]) {
  return rows
    .map((row) => `${row.character_name};${row.matches_count};${row.kills};${row.deaths};${row.assists};${row.treasury_spent};${row.score}`)
    .join("\n");
}

function aggregateRows(rows: CwResultRow[]) {
  const byName = new Map<string, CwResultRow & { tabs_count: number }>();

  for (const row of rows) {
    const name = row.character_name.trim();
    const key = name.toLocaleLowerCase("ru");
    const current = byName.get(key);
    if (!current) {
      byName.set(key, { ...row, matches_count: Math.max(1, toInt(row.matches_count || 1)), character_name: name, tabs_count: 1 });
      continue;
    }

    current.matches_count += Math.max(1, toInt(row.matches_count || 1));
    current.kills += toInt(row.kills);
    current.deaths += toInt(row.deaths);
    current.assists += toInt(row.assists);
    current.treasury_spent += toInt(row.treasury_spent);
    current.score += toInt(row.score);
    current.tabs_count += 1;
  }

  return [...byName.values()].sort((a, b) => b.score - a.score || b.kills - a.kills);
}

function formatKd(row: CwResultRow) {
  if (row.deaths === 0) return row.kills > 0 ? "∞" : "0.00";
  return (row.kills / row.deaths).toFixed(2);
}

function formatKda(row: CwResultRow) {
  if (row.deaths === 0) return row.kills + row.assists > 0 ? "∞" : "0.00";
  return ((row.kills + row.assists) / row.deaths).toFixed(2);
}

function formatStat(value: number) {
  return new Intl.NumberFormat("ru-RU").format(value || 0);
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
  const [ocrStatus, setOcrStatus] = useState("Картинка не сохраняется: OCR работает в браузере.");
  const [ocrPreviewRows, setOcrPreviewRows] = useState<CwResultRow[]>([]);
  const [resultRows, setResultRows] = useState<CwResultRow[]>(() => data.resultQueue || []);
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
  const totalRows = useMemo(() => aggregateRows(resultRows), [resultRows]);

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

  async function uploadRows(rows: CwResultRow[]) {
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
    if (response.ok) {
      setResultRows((current) => [...current, ...rows]);
      setOcrPreviewRows([]);
      setResultText("");
    }
  }

  async function uploadResults() {
    await uploadRows(parseManualResultRows(resultText));
  }

  async function readScreenshot(file: File) {
    setOcrStatus("Распознаю скрин. Файл не отправляется на сервер.");
    setStatus("OCR...");

    try {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng+rus");
      const result = await worker.recognize(file);
      await worker.terminate();

      const rows = parseOcrResultRows(result.data.text || "");
      setOcrPreviewRows(rows);
      setResultText(rowsToText(rows));
      setOcrStatus(
        rows.length
          ? `Распознано строк: ${rows.length}. Проверь строки ниже и нажми “Загрузить табы”.`
          : "OCR не нашёл строки статистики. Попробуй более чёткий скрин или вставь строки вручную.",
      );
      setStatus(rows.length ? "OCR готов." : "OCR без строк.");
    } catch (error) {
      setOcrStatus(error instanceof Error ? error.message : "OCR failed.");
      setStatus("OCR ошибка.");
    }
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
                <h2>Скрины КВ и общая таблица</h2>
              </div>
              <span className="badge muted">{resultRows.length} row(s)</span>
            </div>
            <div className="panel-note">
              Загрузи скрин таба КВ. Сайт распознает таблицу в браузере, покажет строки для проверки и сохранит в Supabase
              только числовую статистику. Сам скрин не сохраняется.
            </div>
            <div className="sc-upload-zone">
              <div>
                <strong>Загрузить скрин</strong>
                <span>{ocrStatus}</span>
              </div>
              <input
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  if (file) void readScreenshot(file);
                  event.currentTarget.value = "";
                }}
                type="file"
              />
            </div>
            {ocrPreviewRows.length > 0 ? (
              <div className="sc-table-card">
                <h3>Предпросмотр OCR</h3>
                <div className="sc-result-table-wrap">
                  <table className="sc-result-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Игрок</th>
                        <th>Матчей</th>
                        <th>Убийства</th>
                        <th>Смерти</th>
                        <th>Помощь</th>
                        <th>Казна</th>
                        <th>Счёт</th>
                        <th>K/D</th>
                        <th>KDA</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ocrPreviewRows.map((row, index) => (
                        <tr key={`${row.character_name}-${index}`}>
                          <td>{index + 1}</td>
                          <td>{row.character_name}</td>
                          <td>{formatStat(row.matches_count || 1)}</td>
                          <td>{formatStat(row.kills)}</td>
                          <td>{formatStat(row.deaths)}</td>
                          <td>{formatStat(row.assists)}</td>
                          <td>{formatStat(row.treasury_spent)}</td>
                          <td>{formatStat(row.score)}</td>
                          <td>{formatKd(row)}</td>
                          <td>{formatKda(row)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
            <div className="panel-note">
              Если OCR ошибся, поправь строки вручную. Формат строки: <code>ник;матчей;kills;deaths;assists;казна;счёт</code>.
            </div>
            <div className="field">
              <label>Распознанные или ручные строки</label>
              <textarea value={resultText} onChange={(event) => setResultText(event.target.value)} placeholder="PlayerOne;12;3;5;1000;320" />
            </div>
            <button className="primary-button sc-primary" onClick={uploadResults} type="button">Загрузить табы</button>

            <div className="sc-table-card">
              <div className="dashboard-head">
                <div>
                  <span className="eyebrow sc-eyebrow">Total table</span>
                  <h3>Общая таблица КВ</h3>
                </div>
                <span className="badge muted">{totalRows.length} player(s)</span>
              </div>
              <div className="sc-result-table-wrap">
                <table className="sc-result-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Игрок</th>
                      <th>Матчей</th>
                      <th>Убийства</th>
                      <th>Смерти</th>
                      <th>Помощь</th>
                      <th>Казна</th>
                      <th>Счёт</th>
                      <th>K/D</th>
                      <th>KDA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {totalRows.length > 0 ? totalRows.map((row, index) => (
                      <tr key={row.character_name}>
                        <td>{index + 1}</td>
                        <td>{row.character_name}</td>
                        <td>{formatStat(row.matches_count || row.tabs_count)}</td>
                        <td>{formatStat(row.kills)}</td>
                        <td>{formatStat(row.deaths)}</td>
                        <td>{formatStat(row.assists)}</td>
                        <td>{formatStat(row.treasury_spent)}</td>
                        <td>{formatStat(row.score)}</td>
                        <td>{formatKd(row)}</td>
                        <td>{formatKda(row)}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={10}>Табы пока не загружены.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
