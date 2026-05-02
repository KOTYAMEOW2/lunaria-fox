"use client";

import { useMemo, useState } from "react";

export type ScDashboardSection = "overview" | "settings" | "attendance" | "squads" | "tabs";

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
  ["overview", "Обзор штаба", ""],
  ["settings", "Настройки", "settings"],
  ["attendance", "Посещения", "attendance"],
  ["squads", "Отряды КВ", "squads"],
  ["tabs", "Табы КВ", "cw-tabs"],
];

const MAX_CW_SQUADS = 7;

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

function normalizeOcrNumberToken(value: string) {
  return String(value || "")
    .replace(/[OoОо]/g, "0")
    .replace(/[IlІ|]/g, "1")
    .replace(/[Зз]/g, "3")
    .replace(/[Бб]/g, "6")
    .replace(/[^\d]/g, "");
}

function isOcrIntegerToken(value: string | undefined) {
  const normalized = normalizeOcrNumberToken(value || "");
  return normalized.length > 0 && normalized.length === String(value || "").replace(/[^\dOoОоIlІ|ЗзБб]/g, "").length;
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

function scoreStalcraftTabCandidate(values: number[]) {
  const [kills, deaths, assists, treasury, score] = values;
  let penalty = 0;

  if (kills < 0 || kills > 1000) penalty += 400;
  if (deaths < 0 || deaths > 1000) penalty += 400;
  if (assists < 0 || assists > 1000) penalty += 400;
  if (treasury < 0 || treasury > 999999999) penalty += 250;
  if (score < 0 || score > 999999999) penalty += 250;
  if (treasury < Math.max(kills, deaths, assists) && score > treasury) penalty += 80;

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

function parseStalcraftScoreboardLine(line: string): CwResultRow | null {
  const normalized = line
    .replace(/[|¦]/g, " ")
    .replace(/[^\p{L}\p{N}\s_[\].#-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return null;

  const tokens = normalized.split(/\s+/);
  if (/^(?:#|№)?[\dOoОоIlІ|]{1,3}$/.test(tokens[0] || "")) {
    tokens.shift();
  }

  while (tokens.length > 0 && !isOcrIntegerToken(tokens[tokens.length - 1])) {
    tokens.pop();
  }

  if (tokens.length < 6) return null;

  let numericStart = tokens.length;
  while (numericStart > 0 && isOcrIntegerToken(tokens[numericStart - 1])) {
    numericStart -= 1;
  }

  const nameTokens = tokens.slice(0, numericStart);
  const numericTokens = tokens.slice(numericStart).map(normalizeOcrNumberToken).filter(Boolean);
  if (nameTokens.length === 0 || numericTokens.length < 5) return null;

  const character_name = nameTokens
    .join(" ")
    .replace(/[^\p{L}\p{N}\s_[\].#-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!character_name || character_name.length < 2) return null;

  const partitionCandidates = buildPartitions(numericTokens, 5, 3)
    .map((partition) => partition.map(groupedInt))
    .map((values) => ({ values, score: scoreStalcraftTabCandidate(values) }))
    .sort((a, b) => a.score - b.score);

  const best = partitionCandidates[0]?.values;
  if (!best) return null;

  return {
    character_name,
    matches_count: 1,
    kills: best[0] || 0,
    deaths: best[1] || 0,
    assists: best[2] || 0,
    treasury_spent: best[3] || 0,
    score: best[4] || 0,
  };
}

function parseOcrResultRows(value: string): CwResultRow[] {
  const ignored = /^(сводка|преимущество|захваченные|информация|ник|игрок|player|name|kills?|убийств|смерт|death|assist|казна|score|счет|счёт|ранг|k\/d|у\s+с\s+п)/i;

  return value
    .split("\n")
    .map((line) => line.replace(/[|¦]/g, " ").trim())
    .filter((line) => line.length > 3 && !ignored.test(line))
    .map((line) => {
      const stalcraftRow = parseStalcraftScoreboardLine(line);
      if (stalcraftRow) return stalcraftRow;

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

function formatMskDateTime(value: string | null | undefined) {
  if (!value) return "нет данных";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "нет данных";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Moscow",
  }).format(date);
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

type OcrCandidate = {
  label: string;
  canvas: HTMLCanvasElement;
};

async function loadImageSource(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; close?: () => void }> {
  if ("createImageBitmap" in window) {
    const bitmap = await createImageBitmap(file);
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      close: () => bitmap.close(),
    };
  }

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Не удалось прочитать изображение."));
    img.src = URL.createObjectURL(file);
  });

  return {
    source: image,
    width: image.naturalWidth,
    height: image.naturalHeight,
    close: () => URL.revokeObjectURL(image.src),
  };
}

function buildOcrCanvas(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  crop: { x: number; y: number; width: number; height: number },
  mode: "threshold" | "contrast",
) {
  const sx = Math.max(0, Math.floor(sourceWidth * crop.x));
  const sy = Math.max(0, Math.floor(sourceHeight * crop.y));
  const sw = Math.min(sourceWidth - sx, Math.floor(sourceWidth * crop.width));
  const sh = Math.min(sourceHeight - sy, Math.floor(sourceHeight * crop.height));
  const scale = Math.min(3, Math.max(1.6, 2600 / Math.max(sw, sh)));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(sw * scale));
  canvas.height = Math.max(1, Math.floor(sh * scale));

  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Canvas недоступен для OCR.");

  context.imageSmoothingEnabled = false;
  context.drawImage(source, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  for (let index = 0; index < data.length; index += 4) {
    const gray = data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114;
    const contrasted = Math.max(0, Math.min(255, (gray - 118) * 2.7 + 128));
    const value = mode === "threshold"
      ? (contrasted > 150 ? 0 : 255)
      : 255 - contrasted;
    data[index] = value;
    data[index + 1] = value;
    data[index + 2] = value;
    data[index + 3] = 255;
  }
  context.putImageData(imageData, 0, 0);

  return canvas;
}

async function buildOcrCandidates(file: File): Promise<OcrCandidate[]> {
  const image = await loadImageSource(file);
  try {
    const crops = [
      { label: "таблица справа", x: 0.28, y: 0.04, width: 0.70, height: 0.70 },
      { label: "таблица широко", x: 0.22, y: 0.00, width: 0.78, height: 0.78 },
      { label: "полный скрин", x: 0.00, y: 0.00, width: 1.00, height: 1.00 },
    ];

    return crops.flatMap((crop) => [
      {
        label: `${crop.label} · контраст`,
        canvas: buildOcrCanvas(image.source, image.width, image.height, crop, "contrast"),
      },
      {
        label: `${crop.label} · порог`,
        canvas: buildOcrCanvas(image.source, image.width, image.height, crop, "threshold"),
      },
    ]);
  } finally {
    image.close?.();
  }
}

export function ScGuildDashboardClient({ guildId, data, activeSection }: Props) {
  const [status, setStatus] = useState("");
  const [resultText, setResultText] = useState("");
  const [ocrStatus, setOcrStatus] = useState("Картинка не сохраняется: OCR работает в браузере.");
  const [ocrPreviewRows, setOcrPreviewRows] = useState<CwResultRow[]>([]);
  const [resultRows, setResultRows] = useState<CwResultRow[]>(() => data.resultQueue || []);
  const [squads, setSquads] = useState<any[]>(() => data.squads || []);
  const [squadMembers, setSquadMembers] = useState<any[]>(() => data.squadMembers || []);
  const [squadForm, setSquadForm] = useState({ name: "", description: "", voice_channel_id: "" });
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
    squads_channel_id: data.settings?.squads_channel_id || "",
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
  const missingSquadTables = (data.schemaWarnings || []).some((warning: string) => warning.includes("sc_cw_squad"));
  const attendanceSummary = useMemo(() => {
    const rows = data.attendance || [];
    return {
      attending: rows.filter((row: any) => row.status === "attending").length,
      absent: rows.filter((row: any) => row.status === "absent").length,
      total: rows.length,
    };
  }, [data.attendance]);
  const totalRows = useMemo(() => aggregateRows(resultRows), [resultRows]);
  const readinessSummary = useMemo(() => {
    const equipmentByUser = new Map<string, Set<string>>();
    for (const item of data.equipment || []) {
      const userId = String(item.discord_user_id || "");
      if (!userId) continue;
      const slots = equipmentByUser.get(userId) || new Set<string>();
      slots.add(String(item.slot || ""));
      equipmentByUser.set(userId, slots);
    }

    const members = data.clanMembers || [];
    const ready = members.filter((member: any) => {
      const slots = equipmentByUser.get(String(member.discord_user_id));
      return slots?.has("weapon") && slots?.has("armor");
    }).length;

    return { ready, total: members.length };
  }, [data.clanMembers, data.equipment]);
  const membersBySquad = useMemo(() => {
    const grouped = new Map<string, any[]>();
    for (const member of squadMembers) {
      const key = String(member.squad_id);
      grouped.set(key, [...(grouped.get(key) || []), member]);
    }
    return grouped;
  }, [squadMembers]);

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
        squads_channel_id: settings.squads_channel_id || null,
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

  async function clearResults() {
    const confirmed = window.confirm("Очистить все загруженные строки табов КВ для этого сервера?");
    if (!confirmed) return;

    setStatus("Очищаю таблицу...");
    const response = await fetch(`/api/sc/guilds/${guildId}/cw-results`, { method: "DELETE" });
    const body = await response.json().catch(() => ({}));
    if (response.ok) {
      setResultRows([]);
      setOcrPreviewRows([]);
      setResultText("");
      setStatus(`Таблица очищена. Удалено строк: ${body.count || 0}.`);
    } else {
      setStatus(body.error || "Ошибка очистки таблицы.");
    }
  }

  async function forceCwPost() {
    setStatus("Отправляю запрос боту...");
    const response = await fetch(`/api/sc/guilds/${guildId}/cw-post`, { method: "POST" });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setStatus(body.error || "Ошибка запуска КВ-поста.");
      return;
    }

    const actionId = body.action?.id;
    if (!actionId) {
      setStatus("Запрос поставлен в очередь, но сайт не получил ID действия.");
      return;
    }

    setStatus("Запрос поставлен в очередь. Проверяю ответ бота...");
    for (let attempt = 0; attempt < 12; attempt += 1) {
      await wait(1500);
      const statusResponse = await fetch(`/api/sc/guilds/${guildId}/cw-post?actionId=${encodeURIComponent(actionId)}`);
      const statusBody = await statusResponse.json().catch(() => ({}));
      const action = statusBody.action;
      if (!statusResponse.ok || !action) continue;

      if (action.status === "done") {
        setStatus("КВ-пост отправлен ботом в выбранный Discord-канал.");
        return;
      }

      if (action.status === "failed") {
        setStatus(action.error_message || "Бот не смог отправить КВ-пост.");
        return;
      }

      if (action.status === "processing") {
        setStatus("Бот принял запрос и отправляет КВ-пост...");
      }
    }

    setStatus("Запрос создан, но бот ещё не подтвердил отправку. Проверь, что бот перезапущен и Supabase Realtime включён.");
  }

  async function mutateSquads(payload: Record<string, unknown>) {
    const response = await fetch(`/api/sc/guilds/${guildId}/squads`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const text = await response.text();
    let body: any = {};
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      body = {};
    }
    if (!response.ok) throw new Error(body.error || text || `Squad request failed (${response.status}).`);
    return body;
  }

  async function createSquad() {
    if (squads.length >= MAX_CW_SQUADS) {
      setStatus(`Лимит отрядов достигнут: максимум ${MAX_CW_SQUADS} на сервер.`);
      return;
    }
    if (!squadForm.name.trim()) {
      setStatus("Название отряда обязательно.");
      return;
    }

    setStatus("Создаю отряд...");
    try {
      const body = await mutateSquads({
        action: "create",
        name: squadForm.name,
        description: squadForm.description || null,
        voice_channel_id: squadForm.voice_channel_id || null,
      });
      setSquads((current) => [...current, body.squad]);
      setSquadForm({ name: "", description: "", voice_channel_id: "" });
      setStatus("Отряд создан.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Ошибка создания отряда.");
    }
  }

  async function deleteSquad(squadId: string) {
    setStatus("Удаляю отряд...");
    try {
      await mutateSquads({ action: "delete", squad_id: squadId });
      setSquads((current) => current.filter((squad) => squad.id !== squadId));
      setSquadMembers((current) => current.filter((member) => member.squad_id !== squadId));
      setStatus("Отряд удалён.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Ошибка удаления отряда.");
    }
  }

  async function assignSquadMember(squadId: string, discordUserId: string) {
    if (!discordUserId) return;
    const member = (data.clanMembers || []).find((row: any) => row.discord_user_id === discordUserId);
    setStatus("Добавляю игрока в отряд...");
    try {
      await mutateSquads({
        action: "assign",
        squad_id: squadId,
        discord_user_id: discordUserId,
        character_name: member?.character_name || null,
      });
      setSquadMembers((current) => [
        ...current.filter((row) => !(row.squad_id === squadId && row.discord_user_id === discordUserId)),
        { squad_id: squadId, discord_user_id: discordUserId, character_name: member?.character_name || null },
      ]);
      setStatus("Игрок добавлен в отряд.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Ошибка добавления игрока.");
    }
  }

  async function removeSquadMember(squadId: string, discordUserId: string) {
    setStatus("Убираю игрока из отряда...");
    try {
      await mutateSquads({ action: "remove", squad_id: squadId, discord_user_id: discordUserId });
      setSquadMembers((current) => current.filter((row) => !(row.squad_id === squadId && row.discord_user_id === discordUserId)));
      setStatus("Игрок убран из отряда.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Ошибка удаления игрока.");
    }
  }

  async function readScreenshot(file: File) {
    setOcrStatus("Готовлю скрин: обрезка таблицы, контраст и OCR. Файл не отправляется на сервер.");
    setStatus("OCR...");

    try {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng+rus");
      const candidates = await buildOcrCandidates(file);
      let bestRows: CwResultRow[] = [];
      let bestLabel = "";
      let bestTextLength = 0;

      try {
        for (const candidate of candidates) {
          setOcrStatus(`OCR: ${candidate.label}...`);
          const result = await worker.recognize(candidate.canvas);
          const text = result.data.text || "";
          const rows = parseOcrResultRows(text);
          if (rows.length > bestRows.length || (rows.length === bestRows.length && text.length > bestTextLength)) {
            bestRows = rows;
            bestLabel = candidate.label;
            bestTextLength = text.length;
          }
          if (rows.length >= 8) break;
        }
      } finally {
        await worker.terminate();
      }

      setOcrPreviewRows(bestRows);
      if (bestRows.length > 0) {
        setResultText(rowsToText(bestRows));
      }
      setOcrStatus(
        bestRows.length
          ? `Распознано строк: ${bestRows.length}. Лучший вариант: ${bestLabel}. Проверь строки ниже и нажми “Загрузить табы”.`
          : `OCR не нашёл строки статистики. Лучший вариант: ${bestLabel || "нет"} (${bestTextLength} символов). Попробуй скрин без затемнения/движения или вставь строки вручную.`,
      );
      setStatus(bestRows.length ? "OCR готов." : "OCR без строк.");
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
            <a className={activeSection === key ? "sidebar-link-active" : ""} href={slug ? `/dashboard/${guildId}/${slug}` : `/dashboard/${guildId}`} key={key}>
              {label}
            </a>
          ))}
        </div>
        <div className="panel-note">
          <strong>КВ:</strong> пост в 14:00 МСК, старт в 20:00 МСК.
        </div>
      </aside>

      <div className="dashboard-sections">
        {activeSection === "overview" ? (
          <section className="dashboard-section panel sc-dashboard-section">
            <div className="dashboard-head">
              <div>
                <span className="eyebrow sc-eyebrow">Operations Overview</span>
                <h2>Штабной обзор</h2>
                <p className="muted">Короткая сводка по текущему состоянию STALCRAFT-сервера.</p>
              </div>
              <span className={`badge ${data.guild?.is_available === false ? "warn" : "success"}`}>{data.guild?.is_available === false ? "bot offline" : "bot online"}</span>
            </div>
            <div className="sc-overview-grid">
              <article className="sc-overview-card">
                <span>КВ сегодня</span>
                <strong>{attendanceSummary.attending}/{attendanceSummary.total || 0}</strong>
                <p>участвуют · отсутствуют {attendanceSummary.absent}</p>
              </article>
              <article className="sc-overview-card">
                <span>Отряды</span>
                <strong>{squads.length}</strong>
                <p>создано для текущего штаба</p>
              </article>
              <article className="sc-overview-card">
                <span>Табы</span>
                <strong>{totalRows.length}</strong>
                <p>игроков в общей таблице</p>
              </article>
              <article className="sc-overview-card">
                <span>Снаряжение</span>
                <strong>{readinessSummary.ready}/{readinessSummary.total}</strong>
                <p>игроков с оружием и бронёй</p>
              </article>
              <article className="sc-overview-card">
                <span>Выброс</span>
                <strong>{data.emission?.state === "active" ? "active" : "idle"}</strong>
                <p>{data.emission?.raw?.region || settings.region || "регион не задан"} · {formatMskDateTime(data.emission?.last_seen_at || data.emission?.updated_at)}</p>
                <p>старт {formatMskDateTime(data.emission?.last_started_at || data.emission?.started_at)} · конец {formatMskDateTime(data.emission?.last_ended_at || data.emission?.ended_at)}</p>
              </article>
              <article className="sc-overview-card">
                <span>Клан</span>
                <strong>{settings.clan_name || data.settings?.clan_name || "не выбран"}</strong>
                <p>{settings.region || "регион не задан"}</p>
              </article>
            </div>
            <div className="sc-overview-actions">
              <a className="primary-button sc-primary" href={`/dashboard/${guildId}/attendance`}>Посещения</a>
              <a className="secondary-button sc-secondary" href={`/dashboard/${guildId}/squads`}>Отряды КВ</a>
              <a className="ghost-button sc-ghost" href={`/dashboard/${guildId}/cw-tabs`}>Табы</a>
              <button className="secondary-button sc-secondary" onClick={forceCwPost} type="button">Запустить КВ-пост сейчас</button>
              {settings.clan_id ? <a className="ghost-button sc-ghost" href={`/clans/${settings.clan_id}`}>Клановая таблица</a> : null}
              <a className="ghost-button sc-ghost" href={`/dashboard/${guildId}/settings`}>Настройки</a>
            </div>
          </section>
        ) : null}

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

            <div className="panel-note">
              Авто-выбросы работают через официальный endpoint <code>https://eapi.stalcraft.net/{"{REGION}"}/emission</code>.
              Для уведомлений выбери регион сервера и канал “Выбросы”.
            </div>

            <div className="section sc-inner-section">
              <h3>Каналы Discord</h3>
              <div className="form-grid">
                {[
                  ["cw_post_channel_id", "КВ-пост"],
                  ["absence_channel_id", "Отсутствия"],
                  ["results_channel_id", "Итоги"],
                  ["squads_channel_id", "Таблица отрядов"],
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
            <div className="sc-overview-actions" style={{ marginBottom: 16 }}>
              <button className="primary-button sc-primary" onClick={forceCwPost} type="button">Запустить КВ-пост сейчас</button>
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

        {activeSection === "squads" ? (
          <section className="dashboard-section panel sc-dashboard-section">
            <div className="dashboard-head">
              <div>
                <span className="eyebrow sc-eyebrow">CW Squads</span>
                <h2>Отряды для КВ</h2>
                <p className="muted">Лидер, полковник или офицер может создать отряды и раскидать игроков клана перед КВ.</p>
              </div>
              <span className="badge muted">{status || `${squads.length} squad(s)`}</span>
            </div>

            {missingSquadTables ? (
              <div className="panel-note sc-panel-warning">
                В Supabase не найдены таблицы отрядов. Выполни SQL <code>supabase/sql/20260502_fix_missing_cw_squads.sql</code>,
                затем обнови страницу.
              </div>
            ) : null}

            <div className="section sc-inner-section">
              <h3>Создать отряд</h3>
              <p className="muted">Лимит: {squads.length}/{MAX_CW_SQUADS} отрядов на сервер.</p>
              <div className="form-grid">
                <div className="field">
                  <label>Название</label>
                  <input value={squadForm.name} onChange={(event) => setSquadForm({ ...squadForm, name: event.target.value })} placeholder="Альфа / Барс / Разведка" />
                </div>
                <div className="field">
                  <label>Голосовой канал</label>
                  <select value={squadForm.voice_channel_id} onChange={(event) => setSquadForm({ ...squadForm, voice_channel_id: event.target.value })}>
                    <option value="">Не привязывать</option>
                    {channelOptions.map((channel: any) => (
                      <option key={`voice-${channel.channel_id}`} value={channel.channel_id}>
                        {channel.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field" style={{ gridColumn: "1 / -1" }}>
                  <label>Описание</label>
                  <input value={squadForm.description} onChange={(event) => setSquadForm({ ...squadForm, description: event.target.value })} placeholder="Задача отряда, состав, роль на КВ" />
                </div>
              </div>
              <button className="primary-button sc-primary" disabled={missingSquadTables || squads.length >= MAX_CW_SQUADS} onClick={createSquad} type="button">Создать отряд</button>
            </div>

            <div className="sc-squad-grid">
              {squads.length > 0 ? squads.map((squad) => {
                const assigned = membersBySquad.get(squad.id) || [];
                return (
                  <article className="sc-squad-card" key={squad.id}>
                    <div className="dashboard-head">
                      <div>
                        <span className="eyebrow sc-eyebrow">Squad</span>
                        <h3>{squad.name}</h3>
                        <p className="muted">{squad.description || "Описание не задано"}</p>
                      </div>
                      <button className="ghost-button sc-danger-button" onClick={() => deleteSquad(squad.id)} type="button">Удалить</button>
                    </div>

                    <div className="field">
                      <label>Добавить игрока клана</label>
                      <select defaultValue="" onChange={(event) => {
                        void assignSquadMember(squad.id, event.target.value);
                        event.currentTarget.value = "";
                      }}>
                        <option value="">Выбери игрока</option>
                        {(data.clanMembers || []).map((member: any) => (
                          <option key={`${squad.id}-${member.discord_user_id}`} value={member.discord_user_id}>
                            {member.character_name || member.discord_user_id}{member.rank ? ` · ${member.rank}` : ""}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="sc-squad-member-list">
                      {assigned.length > 0 ? assigned.map((member) => (
                        <div className="sc-squad-member" key={`${squad.id}-${member.discord_user_id}`}>
                          <span>
                            <strong>{member.character_name || member.discord_user_id}</strong>
                            <small>{member.discord_user_id}</small>
                          </span>
                          <button className="ghost-button" onClick={() => removeSquadMember(squad.id, member.discord_user_id)} type="button">Убрать</button>
                        </div>
                      )) : <p className="panel-note">В отряде пока нет игроков.</p>}
                    </div>
                  </article>
                );
              }) : (
                <article className="panel-note">Отряды ещё не созданы. Создай первый отряд и добавь игроков из состава клана.</article>
              )}
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
              Если OCR ошибся, поправь строки вручную. Формат строки: <code>ник;У;С;П;казна;счёт</code> или <code>ник;матчей;У;С;П;казна;счёт</code>.
            </div>
            <div className="field">
              <label>Распознанные или ручные строки</label>
              <textarea value={resultText} onChange={(event) => setResultText(event.target.value)} placeholder="MihaiGray;4;12;4;64081;3831" />
            </div>
            <div className="sc-overview-actions">
              <button className="primary-button sc-primary" onClick={uploadResults} type="button">Загрузить табы</button>
              <button className="ghost-button sc-danger-button" disabled={resultRows.length === 0} onClick={clearResults} type="button">Очистить таблицу</button>
            </div>

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
