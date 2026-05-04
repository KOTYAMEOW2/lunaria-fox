import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getStalcraftApiBase } from "@/lib/stalcraft/api";

const RATING_REGIONS = ["RU", "EU", "NA", "SEA"] as const;
const CLANS_PAGE_LIMIT = 200;
const DEFAULT_MAX_PER_REGION = 3000;
const RATING_PAGES_CONCURRENCY = 4;

export type ClanRatingSource = "official_api" | "supabase";

export type ClanRatingRow = {
  rank: number;
  clanId: string;
  externalClanId: string | null;
  name: string;
  tag: string | null;
  region: string;
  level: number;
  levelPoints: number;
  memberCount: number;
  leader: string | null;
  score: number;
  source: ClanRatingSource;
  updatedAt: string | null;
};

export type ClanRatingResult = {
  rows: ClanRatingRow[];
  source: ClanRatingSource;
  regions: string[];
  updatedAt: string;
  error: string | null;
};

type ApiClan = {
  id?: string;
  name?: string;
  tag?: string;
  level?: number;
  levelPoints?: number;
  leader?: string;
  memberCount?: number;
};

type PersistedClanRatingRow = {
  clan_id: string;
  external_clan_id: string | null;
  clan_name: string | null;
  name: string | null;
  tag: string | null;
  region: string | null;
  clan_level: number | null;
  clan_level_points: number | null;
  clan_member_count: number | null;
  clan_leader_name: string | null;
  rating_score: number | null;
  rating_rank: number | null;
  rating_updated_at: string | null;
  updated_at: string | null;
};

function applicationToken() {
  return String(process.env.STALCRAFT_APPLICATION_TOKEN || "").trim();
}

function numberValue(value: unknown) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function maxPerRegion() {
  const configured = Number(process.env.STALCRAFT_CLAN_RATING_MAX_PER_REGION || DEFAULT_MAX_PER_REGION);
  if (!Number.isFinite(configured) || configured <= 0) return DEFAULT_MAX_PER_REGION;
  return Math.max(CLANS_PAGE_LIMIT, Math.min(10000, Math.floor(configured)));
}

async function readJson(response: Response) {
  const text = await response.text();
  let payload: any = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const detail = payload?.message || payload?.error || text || response.statusText;
    throw new Error(`STALCRAFT clans API ${response.status}: ${detail}`);
  }

  return payload;
}

async function fetchOfficialClanPage(region: string, offset: number, token: string) {
  const url = new URL(`${getStalcraftApiBase()}/${region.toLowerCase()}/clans`);
  url.searchParams.set("offset", String(offset));
  url.searchParams.set("limit", String(CLANS_PAGE_LIMIT));

  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      authorization: `Bearer ${token}`,
    },
    next: { revalidate: 300 },
  });

  const payload = await readJson(response);
  return {
    total: numberValue(payload?.totalClans),
    data: Array.isArray(payload?.data) ? payload.data as ApiClan[] : [],
  };
}

async function fetchOfficialClanRatings(): Promise<ClanRatingRow[]> {
  const token = applicationToken();
  if (!token) throw new Error("STALCRAFT_APPLICATION_TOKEN is not configured for official clan rating.");

  const limitPerRegion = maxPerRegion();

  async function fetchRegion(region: (typeof RATING_REGIONS)[number]) {
    const rows: ClanRatingRow[] = [];
    let knownTotal = limitPerRegion;
    let reachedEnd = false;
    const totalPages = Math.ceil(limitPerRegion / CLANS_PAGE_LIMIT);
    // Fetch pages in batches of RATING_PAGES_CONCURRENCY (parallel within region)
    for (let batchStart = 0; batchStart < totalPages && !reachedEnd; batchStart += RATING_PAGES_CONCURRENCY) {
      const batch = Array.from({ length: Math.min(RATING_PAGES_CONCURRENCY, totalPages - batchStart) }, (_, i) => batchStart + i)
        .map((batchIdx) => batchIdx * CLANS_PAGE_LIMIT)
        .filter((offset) => offset < Math.min(limitPerRegion, knownTotal))
        .map((offset) => fetchOfficialClanPage(region, offset, token));

      const pages = await Promise.all(batch);
      for (const page of pages) {
        knownTotal = Math.min(knownTotal, page.total || knownTotal);
        for (const clan of page.data) {
          const externalClanId = String(clan.id || "").trim();
          const name = String(clan.name || externalClanId || "Unknown clan").trim();
          const level = numberValue(clan.level);
          const levelPoints = numberValue(clan.levelPoints);
          const memberCount = numberValue(clan.memberCount);
          rows.push({
            rank: 0,
            clanId: externalClanId || `${region}:${name}`,
            externalClanId: externalClanId || null,
            name,
            tag: clan.tag ? String(clan.tag) : null,
            region,
            level,
            levelPoints,
            memberCount,
            leader: clan.leader ? String(clan.leader) : null,
            score: levelPoints || level * 1000 + memberCount,
            source: "official_api",
            updatedAt: null,
          });
        }
        if (page.data.length < CLANS_PAGE_LIMIT) {
          reachedEnd = true;
          break;
        }
      }
    }
    return rows;
  }

  const regionRows = await Promise.all(RATING_REGIONS.map((region) => fetchRegion(region)));
  return regionRows.flat();
}

async function fetchLocalClanRatings(): Promise<ClanRatingRow[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  const [{ data: clans }, { data: members }, { data: audits }] = await Promise.all([
    supabase
      .from("sc_clans")
      .select("clan_id, external_clan_id, clan_name, name, tag, region, clan_level, clan_level_points, clan_member_count, clan_leader_name, rating_score, rating_rank, rating_updated_at, updated_at"),
    supabase
      .from("sc_clan_members")
      .select("clan_id")
      .eq("is_active", true),
    supabase
      .from("sc_cw_result_audit")
      .select("clan_id, total_score, rows_count, published_at"),
  ]);

  const memberCounts = new Map<string, number>();
  for (const member of members || []) {
    const clanId = String(member.clan_id || "");
    if (!clanId) continue;
    memberCounts.set(clanId, (memberCounts.get(clanId) || 0) + 1);
  }

  const auditScores = new Map<string, { score: number; rows: number; updatedAt: string | null }>();
  for (const audit of audits || []) {
    const clanId = String(audit.clan_id || "");
    if (!clanId) continue;
    const current = auditScores.get(clanId) || { score: 0, rows: 0, updatedAt: null };
    current.score += numberValue(audit.total_score);
    current.rows += numberValue(audit.rows_count);
    const publishedAt = audit.published_at ? String(audit.published_at) : null;
    if (publishedAt && (!current.updatedAt || Date.parse(publishedAt) > Date.parse(current.updatedAt))) {
      current.updatedAt = publishedAt;
    }
    auditScores.set(clanId, current);
  }

  return ((clans || []) as PersistedClanRatingRow[]).map((clan) => {
    const clanId = String(clan.clan_id || "");
    const audit = auditScores.get(clanId);
    const memberCount = numberValue(clan.clan_member_count) || memberCounts.get(clanId) || 0;
    const level = numberValue(clan.clan_level);
    const levelPoints = numberValue(clan.clan_level_points);
    const persistedScore = numberValue(clan.rating_score);
    return {
      rank: 0,
      clanId,
      externalClanId: clan.external_clan_id || null,
      name: clan.clan_name || clan.name || clanId,
      tag: clan.tag || null,
      region: clan.region || "—",
      level,
      levelPoints,
      memberCount,
      leader: clan.clan_leader_name || null,
      score: persistedScore || audit?.score || levelPoints || memberCount,
      source: "supabase",
      updatedAt: clan.rating_updated_at || audit?.updatedAt || clan.updated_at || null,
    };
  });
}

function rankRows(rows: ClanRatingRow[]) {
  return rows
    .sort((a, b) => {
      const scoreDiff = b.score - a.score;
      if (scoreDiff) return scoreDiff;
      const levelDiff = b.level - a.level;
      if (levelDiff) return levelDiff;
      const memberDiff = b.memberCount - a.memberCount;
      if (memberDiff) return memberDiff;
      return a.name.localeCompare(b.name, "ru");
    })
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

async function persistOfficialClanRatings(rows: ClanRatingRow[], updatedAt: string) {
  const supabase = getSupabaseAdmin();
  if (!supabase || rows.length === 0) return;

  const payload = rows.map((row) => ({
    clan_id: row.externalClanId || row.clanId,
    external_clan_id: row.externalClanId || row.clanId,
    clan_name: row.name,
    name: row.name,
    tag: row.tag,
    region: row.region,
    source: "official_api",
    clan_level: row.level,
    clan_level_points: row.levelPoints,
    clan_member_count: row.memberCount,
    clan_leader_name: row.leader,
    rating_score: row.score,
    rating_rank: row.rank,
    rating_updated_at: updatedAt,
    updated_at: updatedAt,
  }));

  const { error } = await supabase.from("sc_clans").upsert(payload, { onConflict: "clan_id" });
  if (error) {
    console.warn("[clan-rating] failed to persist official rating:", error.message || error);
  }
}

export async function getClanRating(): Promise<ClanRatingResult> {
  const updatedAt = new Date().toISOString();

  try {
    const officialRows = rankRows(await fetchOfficialClanRatings());
    await persistOfficialClanRatings(officialRows, updatedAt);
    return {
      rows: officialRows,
      source: "official_api",
      regions: [...RATING_REGIONS],
      updatedAt,
      error: null,
    };
  } catch (error) {
    const localRows = rankRows(await fetchLocalClanRatings());
    return {
      rows: localRows,
      source: "supabase",
      regions: [...new Set(localRows.map((row) => row.region).filter(Boolean))],
      updatedAt,
      error: error instanceof Error ? error.message : "Official clan rating failed.",
    };
  }
}
