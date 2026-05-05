import {
  getOfficialStalcraftGearByDataPath,
  resolveOfficialStalcraftGear,
  searchOfficialStalcraftGear,
  type OfficialStalcraftGearItem,
  type StalcraftEquipmentSlot,
} from "./item-database";

export type ExtractedStalcraftEquipment = {
  itemId: string;
  itemName: string;
  itemRank: string | null;
  itemCategory: string | null;
  slot: StalcraftEquipmentSlot;
  raw: unknown;
  verifiedItem: OfficialStalcraftGearItem | null;
  score: number;
};

type RawCandidate = {
  itemName: string | null;
  itemIdentity: string | null;
  itemRank: string | null;
  itemCategory: string | null;
  itemPath: string | null;
  slot: StalcraftEquipmentSlot | null;
  raw: unknown;
  score: number;
};

const EQUIPPED_PATH_MARKERS = ["equipment", "equip", "loadout", "gear", "weapon", "armor", "outfit", "suit"];
const MASTER_MARKERS = ["master", "мастер", "rank_master"];
const WEAPON_MARKERS = [
  "/items/weapon/",
  "weapon",
  "assault_rifle",
  "sniper_rifle",
  "shotgun_rifle",
  "submachine_gun",
  "machine_gun",
  "pistol",
];
const ARMOR_MARKERS = [
  "/items/armor/",
  "armor",
  "combatarmor",
  "sciencearmor",
  "combinedarmor",
  "scientist",
  "combat",
  "combined",
  "clothes",
  "suit",
  "outfit",
];
const IDENTITY_KEYS = ["itemId", "templateId", "itemCode", "code", "resource", "item", "id"];

function cleanOptionalText(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

function readScalarText(value: unknown) {
  if (typeof value === "string" || typeof value === "number") {
    return cleanOptionalText(value);
  }
  return null;
}

function normalizePath(value: string | null | undefined) {
  const path = cleanOptionalText(value)?.replace(/\\/g, "/") || null;
  if (!path) return null;
  return path.startsWith("/") ? path : `/${path}`;
}

function normalizePathLike(value: string | null | undefined) {
  const text = cleanOptionalText(value);
  if (!text) return null;
  if (!/\/items\/|items\/|\.json$/i.test(text)) return null;
  return normalizePath(text);
}

function readTranslationLike(value: unknown) {
  if (!value) return null;
  if (typeof value === "string") return cleanOptionalText(value);
  if (typeof value !== "object") return null;

  const lines = (value as Record<string, unknown>).lines;
  if (!lines || typeof lines !== "object") return null;

  return (
    cleanOptionalText((lines as Record<string, unknown>).ru) ||
    cleanOptionalText((lines as Record<string, unknown>).en) ||
    null
  );
}

function extractName(value: Record<string, unknown>) {
  return (
    readTranslationLike(value.name) ||
    readScalarText(value.name) ||
    readTranslationLike(value.title) ||
    readScalarText(value.title) ||
    readTranslationLike(value.itemName) ||
    readScalarText(value.itemName) ||
    readTranslationLike(value.displayName) ||
    readScalarText(value.displayName) ||
    null
  );
}

function extractPathLike(value: Record<string, unknown>) {
  const keys = ["data", "path", "itemPath", "template", "icon", "iconPath", "asset", "assetPath"];
  for (const key of keys) {
    const scalar = readScalarText(value[key]);
    const candidate = normalizePathLike(scalar);
    if (candidate) return candidate;
  }
  return null;
}

function looksLikeItemIdentity(value: string | null) {
  const text = cleanOptionalText(value);
  if (!text) return false;
  if (/\/items\/.+\.json$/i.test(text)) return true;
  if (/^[a-z0-9]{4,12}$/i.test(text)) return true;
  return false;
}

function extractIdentity(value: Record<string, unknown>) {
  for (const key of IDENTITY_KEYS) {
    const scalar = readScalarText(value[key]);
    if (looksLikeItemIdentity(scalar)) return cleanOptionalText(scalar);
  }

  return null;
}

function extractRank(value: Record<string, unknown>) {
  const rankText = [
    value.rank,
    value.grade,
    value.tier,
    value.rarity,
    value.quality,
    value.color,
    value.level,
  ]
    .map((entry) => readScalarText(entry)?.toLowerCase() || "")
    .find(Boolean);

  if (!rankText) return null;
  if (rankText.startsWith("rank_")) return rankText.slice(5);
  if (rankText.includes("master") || rankText.includes("мастер")) return "master";
  return rankText;
}

function detectSlot(candidate: RawCandidate, pathSegments: string[], record?: Record<string, unknown>) {
  const haystack = [
    candidate.itemCategory,
    candidate.itemPath,
    candidate.itemIdentity,
    ...pathSegments,
    ...(record ? Object.keys(record) : []),
  ]
    .map((value) => String(value || "").toLowerCase())
    .join(" ");

  if (WEAPON_MARKERS.some((marker) => haystack.includes(marker))) return "weapon";
  if (ARMOR_MARKERS.some((marker) => haystack.includes(marker))) return "armor";
  return null;
}

function hasEquipMarker(pathSegments: string[]) {
  return pathSegments.some((segment) =>
    EQUIPPED_PATH_MARKERS.some((marker) => String(segment || "").toLowerCase().includes(marker)),
  );
}

function hasTrueFlag(value: Record<string, unknown>) {
  return [
    "equipped",
    "selected",
    "active",
    "current",
    "isEquipped",
    "inUse",
    "isCurrent",
  ].some((key) => value[key] === true);
}

function deriveScore(candidate: RawCandidate, pathSegments: string[], equipped: boolean) {
  let score = 0;
  if (candidate.itemPath?.includes("/items/")) score += 40;
  if (hasEquipMarker(pathSegments)) score += 30;
  if (equipped) score += 30;
  if (candidate.itemRank === "master") score += 24;
  if (candidate.itemCategory) score += 14;
  if (candidate.itemIdentity) score += 12;
  if ((candidate.itemName || "").length >= 4) score += 10;
  return score;
}

function shouldKeepCandidate(candidate: RawCandidate, equipped: boolean) {
  if (!candidate.slot && !candidate.itemPath && !candidate.itemIdentity) return false;
  if (!candidate.itemName && !candidate.itemPath && !candidate.itemIdentity) return false;
  if (candidate.itemRank === "master") return true;
  if (equipped) return true;
  if (candidate.itemPath?.includes("/items/")) return true;
  if (candidate.itemIdentity) return true;
  return false;
}

function dedupeCandidates(candidates: RawCandidate[]) {
  const best = new Map<string, RawCandidate>();

  for (const candidate of candidates) {
    const key = `${candidate.slot || "unknown"}:${candidate.itemPath || candidate.itemIdentity || String(candidate.itemName || "").toLowerCase()}`;
    const current = best.get(key);
    if (!current || candidate.score > current.score) {
      best.set(key, candidate);
    }
  }

  return [...best.values()];
}

export async function extractStalcraftEquipmentFromPayload(payload: unknown) {
  const stack: Array<{ value: unknown; path: string[] }> = [{ value: payload, path: [] }];
  const rawCandidates: RawCandidate[] = [];

  while (stack.length) {
    const current = stack.pop();
    if (!current?.value) continue;

    const scalarText = readScalarText(current.value);
    if (scalarText) {
      const scalarPath = normalizePathLike(scalarText);
      const scalarCandidate: RawCandidate = {
        itemName: scalarPath ? null : scalarText,
        itemIdentity: scalarText,
        itemRank: null,
        itemCategory: null,
        itemPath: scalarPath,
        slot: null,
        raw: scalarText,
        score: 0,
      };

      scalarCandidate.slot = detectSlot(scalarCandidate, current.path);
      scalarCandidate.score = deriveScore(scalarCandidate, current.path, false);
      if (shouldKeepCandidate(scalarCandidate, false) && hasEquipMarker(current.path)) {
        rawCandidates.push(scalarCandidate);
      }
      continue;
    }

    if (typeof current.value !== "object") continue;

    if (Array.isArray(current.value)) {
      current.value.forEach((entry, index) => stack.push({ value: entry, path: [...current.path, String(index)] }));
      continue;
    }

    const record = current.value as Record<string, unknown>;
    const itemName = extractName(record);
    const itemPath = extractPathLike(record);
    const itemIdentity = extractIdentity(record);
    const itemCategory =
      readScalarText(record.category) ||
      readScalarText(record.type) ||
      readScalarText(record.slot) ||
      readScalarText(record.kind) ||
      null;
    const itemRank = extractRank(record);
    const equipped = hasTrueFlag(record);
    const slotHint = detectSlot(
      {
        itemName,
        itemIdentity,
        itemRank,
        itemCategory,
        itemPath,
        slot: null,
        raw: record,
        score: 0,
      },
      current.path,
      record,
    );
    const likelyEquipment = equipped || Boolean(slotHint) || hasEquipMarker([...current.path, ...Object.keys(record)]) || Boolean(itemPath?.includes("/items/"));

    if ((itemName || itemPath || itemIdentity) && likelyEquipment) {
      const candidate: RawCandidate = {
        itemName,
        itemIdentity,
        itemRank,
        itemCategory,
        itemPath,
        slot: null,
        raw: record,
        score: 0,
      };

      candidate.slot = detectSlot(candidate, current.path, record);
      candidate.score = deriveScore(candidate, current.path, equipped);

      if (shouldKeepCandidate(candidate, equipped)) {
        rawCandidates.push(candidate);
      }
    }

    for (const [key, child] of Object.entries(record)) {
      if (child && typeof child === "object") {
        stack.push({ value: child, path: [...current.path, key] });
      }
    }
  }

  const deduped = dedupeCandidates(rawCandidates);
  const equipment: ExtractedStalcraftEquipment[] = [];

  async function resolveBestEffort(query: string | null, slot: StalcraftEquipmentSlot | null) {
    const cleanQuery = cleanOptionalText(query);
    if (!cleanQuery) return null;

    try {
      return (await resolveOfficialStalcraftGear(cleanQuery, slot || null)).item;
    } catch {
      const fallback = await searchOfficialStalcraftGear(cleanQuery, slot || null, 1);
      return fallback[0]?.score && fallback[0].score >= 700 ? fallback[0].item : null;
    }
  }

  for (const candidate of deduped) {
    let verifiedItem = candidate.itemPath ? await getOfficialStalcraftGearByDataPath(candidate.itemPath) : null;

    if (!verifiedItem && candidate.itemName) {
      verifiedItem = await resolveBestEffort(candidate.itemName, candidate.slot || null);
    }

    if (!verifiedItem && candidate.itemIdentity) {
      verifiedItem = await resolveBestEffort(candidate.itemIdentity, candidate.slot || null);
    }

    const slot = verifiedItem?.slot || candidate.slot;
    if (!slot) continue;

    const rank = verifiedItem?.rank || candidate.itemRank || null;
    const keepBecauseVerified = Boolean(verifiedItem);
    const keepBecauseMaster = rank === "master";
    if (!keepBecauseVerified && !keepBecauseMaster) continue;

    equipment.push({
      itemId: verifiedItem?.itemId || candidate.itemPath || candidate.itemIdentity || candidate.itemName || crypto.randomUUID(),
      itemName: verifiedItem?.itemName || candidate.itemName || candidate.itemIdentity || "Unknown item",
      itemRank: rank,
      itemCategory: verifiedItem?.category || candidate.itemCategory || slot,
      slot,
      raw: candidate.raw,
      verifiedItem,
      score: candidate.score + (verifiedItem ? 50 : 0),
    });
  }

  const bestBySlot = new Map<string, ExtractedStalcraftEquipment>();
  for (const item of equipment.sort((left, right) => right.score - left.score)) {
    const key = `${item.slot}:${item.itemId}`;
    if (!bestBySlot.has(key)) {
      bestBySlot.set(key, item);
    }
  }

  return [...bestBySlot.values()].sort((left, right) => {
    if (left.slot !== right.slot) return left.slot.localeCompare(right.slot);
    return right.score - left.score;
  });
}
