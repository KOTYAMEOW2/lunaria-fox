const OFFICIAL_STALCRAFT_LISTING_URL =
  "https://raw.githubusercontent.com/EXBO-Studio/stalcraft-database/main/global/listing.json";
const STALCRAFT_WIKI_SEARCH_BASE = "https://stalcraft.wiki/?search=";
const CATALOG_CACHE_TTL_MS = 1000 * 60 * 60 * 6;
const EXTRA_ALIASES_BY_ITEM_ID: Record<string, string[]> = {
  "2ovr0": ["сатурн"],
  "4ql1r": ["центурион"],
  "y3q1o": ["танк", "sba tank"],
};

export type StalcraftEquipmentSlot = "weapon" | "armor";

type ListingRow = {
  data?: string;
  color?: string | null;
  icon?: string | null;
  name?: {
    lines?: {
      ru?: string | null;
      en?: string | null;
    } | null;
  } | null;
};

export type OfficialStalcraftGearItem = {
  itemId: string;
  itemPath: string;
  itemName: string;
  itemNameRu: string | null;
  itemNameEn: string | null;
  slot: StalcraftEquipmentSlot;
  category: string;
  rank: string | null;
  isMaster: boolean;
  wikiUrl: string;
  aliases: string[];
  normalizedAliases: string[];
};

export type OfficialStalcraftGearSearchResult = {
  item: OfficialStalcraftGearItem;
  score: number;
  exact: boolean;
};

export type ResolveOfficialStalcraftGearResult = {
  item: OfficialStalcraftGearItem;
  confidence: "exact" | "strong" | "fuzzy";
  suggestions: OfficialStalcraftGearSearchResult[];
};

type CatalogState = {
  fetchedAt: number;
  items: OfficialStalcraftGearItem[];
  byPath: Map<string, OfficialStalcraftGearItem>;
};

let cachedCatalog: CatalogState | null = null;
let pendingCatalog: Promise<CatalogState> | null = null;

function cleanOptionalText(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

function normalizeCatalogPath(value: string) {
  const path = String(value || "").trim().replace(/\\/g, "/");
  return path.startsWith("/") ? path : `/${path}`;
}

function parseRank(color: string | null | undefined) {
  const value = String(color || "").trim().toLowerCase();
  if (!value) return null;
  if (value.startsWith("rank_")) return value.slice(5);
  return value || null;
}

function buildWikiUrl(name: string) {
  return `${STALCRAFT_WIKI_SEARCH_BASE}${encodeURIComponent(name)}`;
}

function isSupportedWeaponCategory(category: string) {
  return !["device", "melee"].includes(category);
}

function isSupportedArmorCategory(category: string) {
  return category !== "device";
}

function deriveSlotFromPath(path: string): StalcraftEquipmentSlot | null {
  if (path.includes("/items/weapon/")) return "weapon";
  if (path.includes("/items/armor/")) return "armor";
  return null;
}

function deriveCategoryFromPath(path: string, slot: StalcraftEquipmentSlot) {
  const segments = normalizeCatalogPath(path).split("/").filter(Boolean);
  const slotIndex = segments.indexOf(slot);
  return segments[slotIndex + 1] || slot;
}

function deriveItemId(path: string) {
  const normalized = normalizeCatalogPath(path);
  const basename = normalized.split("/").pop() || normalized;
  return basename.replace(/\.json$/i, "");
}

export function normalizeStalcraftSearchText(value: string) {
  return String(value || "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[«»"'`]/g, "")
    .replace(/[_/\\|]+/g, " ")
    .replace(/[-]+/g, " ")
    .replace(/[^a-z0-9а-я]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildAliases(itemNameRu: string | null, itemNameEn: string | null, itemId: string) {
  const seen = new Set<string>();
  const aliases = [itemNameRu, itemNameEn, itemId, ...(EXTRA_ALIASES_BY_ITEM_ID[itemId] || [])]
    .map((value) => cleanOptionalText(value))
    .filter(Boolean) as string[];

  for (const alias of aliases) {
    seen.add(alias);
  }

  return [...seen];
}

function boundedLevenshtein(a: string, b: string, maxDistance = 3) {
  if (a === b) return 0;
  if (!a || !b) return Math.max(a.length, b.length);
  if (Math.abs(a.length - b.length) > maxDistance) return null;

  const prev = Array.from({ length: b.length + 1 }, (_, index) => index);
  const next = new Array<number>(b.length + 1).fill(0);

  for (let i = 1; i <= a.length; i += 1) {
    next[0] = i;
    let rowMin = next[0];

    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      next[j] = Math.min(
        prev[j] + 1,
        next[j - 1] + 1,
        prev[j - 1] + cost,
      );
      rowMin = Math.min(rowMin, next[j]);
    }

    if (rowMin > maxDistance) return null;

    for (let j = 0; j <= b.length; j += 1) {
      prev[j] = next[j];
    }
  }

  return prev[b.length] <= maxDistance ? prev[b.length] : null;
}

function scoreAliasMatch(alias: string, query: string) {
  if (!alias || !query) return 0;
  if (alias === query) return 1000;

  const aliasLengthDelta = Math.abs(alias.length - query.length);

  if (alias.startsWith(query) && query.length >= 3) {
    return 930 - Math.min(150, aliasLengthDelta * 6);
  }

  if (query.startsWith(alias) && alias.length >= 4) {
    return 870 - Math.min(140, aliasLengthDelta * 6);
  }

  if (alias.includes(query) && query.length >= 4) {
    return 790 - Math.min(120, aliasLengthDelta * 4);
  }

  const queryTokens = query.split(" ").filter(Boolean);
  if (queryTokens.length > 1 && queryTokens.every((token) => alias.includes(token))) {
    return 740 - Math.min(100, aliasLengthDelta * 3);
  }

  if (query.length >= 5) {
    const distance = boundedLevenshtein(alias, query, 3);
    if (distance !== null) {
      return 700 - distance * 70 - Math.min(80, aliasLengthDelta * 4);
    }
  }

  return 0;
}

async function fetchOfficialCatalog() {
  const response = await fetch(OFFICIAL_STALCRAFT_LISTING_URL, {
    cache: "force-cache",
    next: { revalidate: Math.floor(CATALOG_CACHE_TTL_MS / 1000) },
  });

  if (!response.ok) {
    throw new Error(`Official STALCRAFT item database failed: ${response.status}`);
  }

  const payload = (await response.json()) as ListingRow[];
  const byPath = new Map<string, OfficialStalcraftGearItem>();
  const items: OfficialStalcraftGearItem[] = [];

  for (const row of payload || []) {
    const itemPath = normalizeCatalogPath(row.data || "");
    const slot = deriveSlotFromPath(itemPath);
    if (!slot) continue;

    const category = deriveCategoryFromPath(itemPath, slot);
    if (slot === "weapon" && !isSupportedWeaponCategory(category)) continue;
    if (slot === "armor" && !isSupportedArmorCategory(category)) continue;

    const itemId = deriveItemId(itemPath);
    const itemNameRu = cleanOptionalText(row.name?.lines?.ru);
    const itemNameEn = cleanOptionalText(row.name?.lines?.en);
    const itemName = itemNameRu || itemNameEn || itemId;
    const aliases = buildAliases(itemNameRu, itemNameEn, itemId);
    const normalizedAliases = aliases.map((alias) => normalizeStalcraftSearchText(alias)).filter(Boolean);
    const rank = parseRank(row.color);

    const item: OfficialStalcraftGearItem = {
      itemId,
      itemPath,
      itemName,
      itemNameRu,
      itemNameEn,
      slot,
      category,
      rank,
      isMaster: rank === "master",
      wikiUrl: buildWikiUrl(itemName),
      aliases,
      normalizedAliases,
    };

    items.push(item);
    byPath.set(itemPath, item);
  }

  return {
    fetchedAt: Date.now(),
    items,
    byPath,
  } satisfies CatalogState;
}

async function getCatalogState() {
  if (cachedCatalog && Date.now() - cachedCatalog.fetchedAt < CATALOG_CACHE_TTL_MS) {
    return cachedCatalog;
  }

  if (!pendingCatalog) {
    pendingCatalog = fetchOfficialCatalog()
      .then((state) => {
        cachedCatalog = state;
        return state;
      })
      .finally(() => {
        pendingCatalog = null;
      });
  }

  return pendingCatalog;
}

export async function getOfficialStalcraftGearByDataPath(itemPath: string) {
  const normalizedPath = normalizeCatalogPath(itemPath);
  const state = await getCatalogState();
  return state.byPath.get(normalizedPath) || null;
}

export async function searchOfficialStalcraftGear(
  query: string,
  slot?: StalcraftEquipmentSlot | null,
  limit = 5,
) {
  const normalizedQuery = normalizeStalcraftSearchText(query);
  if (!normalizedQuery) return [] as OfficialStalcraftGearSearchResult[];

  const state = await getCatalogState();
  const results: OfficialStalcraftGearSearchResult[] = [];

  for (const item of state.items) {
    if (slot && item.slot !== slot) continue;

    let bestScore = 0;
    let exact = false;
    for (const alias of item.normalizedAliases) {
      const score = scoreAliasMatch(alias, normalizedQuery);
      if (score > bestScore) {
        bestScore = score;
        exact = alias === normalizedQuery;
      }
    }

    if (bestScore < 620) continue;

    results.push({
      item,
      score: bestScore + (item.isMaster ? 8 : 0),
      exact,
    });
  }

  return results
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      if (left.exact !== right.exact) return left.exact ? -1 : 1;
      if (left.item.isMaster !== right.item.isMaster) return left.item.isMaster ? -1 : 1;
      return left.item.itemName.localeCompare(right.item.itemName, "ru");
    })
    .slice(0, limit);
}

export async function resolveOfficialStalcraftGear(
  query: string,
  slot?: StalcraftEquipmentSlot | null,
) {
  const normalizedQuery = normalizeStalcraftSearchText(query);
  const suggestions = await searchOfficialStalcraftGear(query, slot, 5);
  const best = suggestions[0];
  const runnerUp = suggestions[1];

  if (!best) {
    throw new Error("Предмет не найден в официальной базе STALCRAFT.");
  }

  const ambiguous =
    !best.exact &&
    normalizedQuery.length <= 10 &&
    runnerUp &&
    runnerUp.score >= best.score - 24;

  if (ambiguous) {
    const names = suggestions.slice(0, 4).map((entry) => entry.item.itemName).join(", ");
    throw new Error(`Нашлось несколько похожих предметов. Уточни название: ${names}.`);
  }

  if (best.score < 660) {
    throw new Error("Предмет не найден в официальной базе STALCRAFT.");
  }

  const confidence =
    best.exact ? "exact" :
    best.score >= 840 ? "strong" :
    "fuzzy";

  return {
    item: best.item,
    confidence,
    suggestions,
  } satisfies ResolveOfficialStalcraftGearResult;
}

export function buildStalcraftWikiSearchUrl(itemName: string) {
  return buildWikiUrl(itemName);
}
