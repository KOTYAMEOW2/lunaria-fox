import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  exchangeStalcraftCode,
  fetchExboUser,
  fetchStalcraftCharacters,
  refreshStalcraftToken,
} from "@/lib/stalcraft/api";
import { extractStalcraftEquipmentFromPayload } from "@/lib/stalcraft/equipment-extractor";
import {
  buildStalcraftWikiSearchUrl,
  resolveOfficialStalcraftGear,
} from "@/lib/stalcraft/item-database";
import type {
  StalcraftCharacterCacheRow,
  StalcraftCommunityRow,
  StalcraftGuildSettingsRow,
  StalcraftProfileRow,
  StalcraftProfileShowcaseRow,
  StalcraftRegion,
} from "@/lib/stalcraft/types";

export const STALCRAFT_REGIONS: StalcraftRegion[] = ["RU", "EU", "NA", "SEA"];

// ─── Friends extraction ───────────────────────────────────────────────────────

interface FriendCandidate {
  id: string | null;
  uuid: string | null;
  name: string | null;
  source: string;
}

function walkForFriends(value: unknown, found: Map<string, FriendCandidate> = new Map(), depth = 0): Map<string, FriendCandidate> {
  if (depth > 10 || !value || typeof value !== "object") return found;
  if (Array.isArray(value)) {
    for (const item of value) walkForFriends(item, found, depth + 1);
    return found;
  }

  const obj = value as Record<string, unknown>;

  // Look for friend-like keys at this level
  const keys = Object.keys(obj);
  const keySig = keys.join(" ").toLowerCase();

  if (/(friend|friends|друг)/.test(keySig)) {
    const id = typeof obj.id === "string" || typeof obj.id === "number" ? String(obj.id) : null;
    const uuid = typeof obj.uuid === "string" ? obj.uuid : null;
    const name =
      typeof obj.name === "string" ? obj.name
      : typeof obj.login === "string" ? obj.login
      : typeof obj.nickname === "string" ? obj.nickname
      : null;

    if (id || uuid || name) {
      const key = uuid || id || name || crypto.randomUUID();
      if (!found.has(key)) {
        found.set(key, { id, uuid, name, source: "exbo" });
      }
    }
  }

  // Recurse into nested values
  for (const val of Object.values(obj)) {
    if (val && typeof val === "object") {
      walkForFriends(val, found, depth + 1);
    }
  }

  return found;
}

async function syncRegisteredFriends(discordUserId: string, rows: StalcraftCharacterCacheRow[]) {
  const rawFriends = walkForFriends(rows.map((row) => row.raw));
  const candidates = [...rawFriends.values()];
  if (candidates.length === 0) return;

  const supabase = requireSupabase();
  const ids = candidates.map((c) => c.id).filter(Boolean) as string[];
  const uuids = candidates.map((c) => c.uuid).filter(Boolean) as string[];
  const names = candidates.map((c) => c.name).filter(Boolean) as string[];

  let query = supabase
    .from("sc_players")
    .select("discord_user_id, exbo_id, exbo_uuid, exbo_login, exbo_display_login, selected_character_name")
    .neq("discord_user_id", discordUserId);

  if (ids.length + uuids.length + names.length === 0) return;

  const filters: string[] = [
    ...ids.map((id) => `exbo_id.eq.${id}`),
    ...uuids.map((uuid) => `exbo_uuid.eq.${uuid}`),
    ...names.map((name) => `exbo_login.eq.${name}`),
    ...names.map((name) => `exbo_display_login.eq.${name}`),
    ...names.map((name) => `selected_character_name.eq.${name}`),
  ];

  const { data, error } = await query.or(filters.join(","));
  if (error || !data?.length) return;

  const now = new Date().toISOString();
  const payload = (data as Array<Record<string, unknown>>).map((friend) => ({
    discord_user_id: discordUserId,
    friend_discord_user_id: String(friend.discord_user_id),
    source: "exbo",
    game_friend_name: String(friend.selected_character_name || friend.exbo_display_login || friend.exbo_login || ""),
    matched_by: "profile_payload",
    synced_at: now,
  }));

  await supabase.from("sc_friends").upsert(payload, { onConflict: "discord_user_id,friend_discord_user_id" });
}

// ─── Equipment with official DB validation ───────────────────────────────────

async function syncApiEquipmentSnapshot(discordUserId: string, characterId: string, payload: unknown) {
  const equipment = await extractStalcraftEquipmentFromPayload(payload);
  if (equipment.length === 0) return [];

  const now = new Date().toISOString();
  const supabase = requireSupabase();

  const rows = equipment.map((item) => ({
    discord_user_id: discordUserId,
    character_id: characterId,
    slot: item.slot,
    item_id: item.verifiedItem?.itemId || item.itemId,
    item_name: item.verifiedItem?.itemName || item.itemName,
    item_rank: item.verifiedItem?.rank || item.itemRank,
    item_level: item.verifiedItem?.rank || item.itemRank || "master",
    item_category: item.verifiedItem?.category || item.itemCategory || item.slot,
    source: "api",
    verified_by: item.verifiedItem ? "official-database" : null,
    verified_at: item.verifiedItem ? now : null,
    raw: {
      source: "oauth-api",
      synced_at: now,
      official_path: item.verifiedItem?.itemPath || null,
      wiki_url: item.verifiedItem?.wikiUrl || buildStalcraftWikiSearchUrl(item.itemName),
      payload: item.raw,
    },
    updated_at: now,
  }));

  const { error: cleanupError } = await supabase
    .from("sc_equipment")
    .delete()
    .eq("discord_user_id", discordUserId)
    .eq("character_id", characterId)
    .eq("source", "api");
  if (cleanupError) throw cleanupError;

  const { data, error } = await supabase
    .from("sc_equipment")
    .upsert(rows, { onConflict: "discord_user_id,character_id,slot,item_id" })
    .select("*");
  if (error) throw error;

  return data || [];
}

export async function saveManualStalcraftEquipment(
  discordUserId: string,
  payload: { slot: "weapon" | "armor"; itemName: string; itemRank?: string | null; itemCategory?: string | null },
) {
  const profile = await getStalcraftProfile(discordUserId);
  if (!profile?.selected_character_id) throw new Error("Сначала выбери STALCRAFT-персонажа.");

  const now = new Date().toISOString();
  const itemName = payload.itemName.trim();
  if (!itemName) throw new Error("Название предмета обязательно.");
  if (itemName.length < 2) throw new Error("Название предмета слишком короткое.");

  const resolved = await resolveOfficialStalcraftGear(itemName, payload.slot);
  const official = resolved.item;
  const supabase = requireSupabase();

  const { data: ownedItems, error: ownedItemsError } = await supabase
    .from("sc_equipment")
    .select("id, slot, item_id, item_name, source, verified_at, raw")
    .eq("discord_user_id", discordUserId)
    .eq("character_id", profile.selected_character_id)
    .eq("source", "api");
  if (ownedItemsError) throw ownedItemsError;

  const ownsOfficialItem = (ownedItems || []).some((row: any) => {
    const raw = row.raw && typeof row.raw === "object" ? row.raw : {};
    const officialId = cleanOptionalText((raw as Record<string, unknown>).official_item_id);
    const officialPath = cleanOptionalText((raw as Record<string, unknown>).official_path);
    return (
      String(row.slot || "") === official.slot &&
      (
        String(row.item_id || "") === official.itemId ||
        officialId === official.itemId ||
        officialPath === official.itemPath ||
        String(row.item_name || "") === official.itemName
      )
    );
  });

  if (!ownsOfficialItem) {
    throw new Error("Этот предмет не найден у выбранного персонажа в API-снимке. Сначала обнови персонажей или выбери вещь из реально найденного снаряжения.");
  }

  const { error: cleanupError } = await supabase
    .from("sc_equipment")
    .delete()
    .eq("discord_user_id", discordUserId)
    .eq("character_id", profile.selected_character_id)
    .eq("slot", official.slot)
    .eq("source", "manual");
  if (cleanupError) throw cleanupError;

  const { data, error } = await supabase
    .from("sc_equipment")
    .upsert(
      {
        discord_user_id: discordUserId,
        character_id: profile.selected_character_id,
        slot: official.slot,
        item_id: `manual-${official.itemId}`,
        item_name: official.itemName,
        item_rank: official.rank || payload.itemRank?.trim() || "master",
        item_level: official.rank || payload.itemRank?.trim() || "master",
        item_category: official.category || payload.itemCategory?.trim() || official.slot,
        source: "manual",
        verified_by: "official-database",
        verified_at: now,
        raw: {
          source: "site",
          validated_at: now,
          requested_input: itemName,
          confidence: resolved.confidence,
          official_item_id: official.itemId,
          official_path: official.itemPath,
          official_name_ru: official.itemNameRu,
          official_name_en: official.itemNameEn,
          wiki_url: official.wikiUrl,
        },
        updated_at: now,
      },
      { onConflict: "discord_user_id,character_id,slot,item_id" },
    )
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

// ─── Re-export everything else unchanged ──────────────────────────────────────

function requireSupabase() {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

function tokenExpiry(expiresIn: number) {
  return new Date(Date.now() + Math.max(0, expiresIn - 60) * 1000).toISOString();
}

function cleanOptionalText(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

function buildClanRowsFromCharacters(rows: StalcraftCharacterCacheRow[]) {
  const now = new Date().toISOString();
  const clans = new Map<
    string,
    { clan_id: string; external_clan_id: string; clan_name: string; name: string; region: StalcraftRegion; source: string; updated_at: string }
  >();

  for (const row of rows) {
    const clanId = cleanOptionalText(row.clan_id);
    if (!clanId || clans.has(clanId)) continue;
    clans.set(clanId, {
      clan_id: clanId,
      external_clan_id: clanId,
      clan_name: cleanOptionalText(row.clan_name) || clanId,
      name: cleanOptionalText(row.clan_name) || clanId,
      region: row.region,
      source: "exbo",
      updated_at: now,
    });
  }

  return [...clans.values()];
}

function normalizeClanAccessLevel(rank: string | null | undefined) {
  const value = String(rank || "").toLowerCase();
  if (/(leader|commander|owner|глава|лидер|командир)/i.test(value)) return "leader";
  if (/(colonel|полков)/i.test(value)) return "colonel";
  if (/(officer|офицер)/i.test(value)) return "officer";
  return "member";
}

function buildClanMemberRowsFromCharacters(discordUserId: string, rows: StalcraftCharacterCacheRow[]) {
  const now = new Date().toISOString();
  const members = new Map<string, { clan_id: string; discord_user_id: string; character_id: string; character_name: string; rank: string | null; is_active: boolean; updated_at: string }>();

  for (const row of rows) {
    const clanId = cleanOptionalText(row.clan_id);
    if (!clanId) continue;
    members.set(`${clanId}:${discordUserId}`, {
      clan_id: clanId,
      discord_user_id: discordUserId,
      character_id: row.character_id,
      character_name: row.character_name,
      rank: row.clan_rank,
      is_active: true,
      updated_at: now,
    });
  }

  return [...members.values()];
}

function buildClanAccessRowsFromCharacters(discordUserId: string, rows: StalcraftCharacterCacheRow[]) {
  const access = new Map<string, { clan_id: string; discord_user_id: string; access_level: string; granted_by: string }>();

  for (const row of rows) {
    const clanId = cleanOptionalText(row.clan_id);
    if (!clanId) continue;
    access.set(`${clanId}:${discordUserId}`, {
      clan_id: clanId,
      discord_user_id: discordUserId,
      access_level: normalizeClanAccessLevel(row.clan_rank),
      granted_by: "exbo",
    });
  }

  return [...access.values()];
}

export async function getStalcraftProfile(discordUserId: string) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("sc_players")
    .select("*")
    .eq("discord_user_id", discordUserId)
    .maybeSingle();

  if (error) throw error;
  return (data || null) as StalcraftProfileRow | null;
}

export async function getStalcraftProfileShowcase(discordUserId: string) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("sc_profile_showcases")
    .select("*")
    .eq("discord_user_id", discordUserId)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    return {
      discord_user_id: discordUserId,
      title: null,
      bio: null,
      accent_color: "#88ffc0",
      banner_url: null,
      avatar_frame: null,
      card_style: "stalker",
      pinned_weapon: null,
      pinned_armor: null,
      badges: [],
      visibility: "clan",
      updated_at: null,
    } satisfies StalcraftProfileShowcaseRow;
  }

  return {
    ...data,
    badges: Array.isArray((data as any).badges) ? (data as any).badges : [],
    visibility: ((data as any).visibility || "clan") as StalcraftProfileShowcaseRow["visibility"],
  } as StalcraftProfileShowcaseRow;
}

export async function saveStalcraftProfileShowcase(
  discordUserId: string,
  payload: {
    title: string | null;
    bio: string | null;
    visibility: "public" | "clan" | "private";
    pinnedWeaponId: string | null;
    pinnedArmorId: string | null;
  },
) {
  const supabase = requireSupabase();
  const now = new Date().toISOString();

  const candidateIds = [payload.pinnedWeaponId, payload.pinnedArmorId].filter(Boolean) as string[];
  const allowedEquipment = new Map<string, { id: string; slot: string; source: string | null; verified_at: string | null }>();

  if (candidateIds.length > 0) {
    const { data: equipmentRows, error: equipmentError } = await supabase
      .from("sc_equipment")
      .select("id, slot, source, verified_at")
      .eq("discord_user_id", discordUserId)
      .in("id", candidateIds);
    if (equipmentError) throw equipmentError;

    for (const row of (equipmentRows || []) as Array<{ id: string; slot: string; source: string | null; verified_at: string | null }>) {
      if (row.source === "api" || row.verified_at) {
        allowedEquipment.set(row.id, row);
      }
    }
  }

  if (payload.pinnedWeaponId) {
    const row = allowedEquipment.get(payload.pinnedWeaponId);
    if (!row || row.slot !== "weapon") {
      throw new Error("Основное оружие можно выбрать только из подтверждённых API-предметов.");
    }
  }

  if (payload.pinnedArmorId) {
    const row = allowedEquipment.get(payload.pinnedArmorId);
    if (!row || row.slot !== "armor") {
      throw new Error("Основную броню можно выбрать только из подтверждённых API-предметов.");
    }
  }

  const { data, error } = await supabase
    .from("sc_profile_showcases")
    .upsert(
      {
        discord_user_id: discordUserId,
        title: cleanOptionalText(payload.title),
        bio: cleanOptionalText(payload.bio),
        visibility: payload.visibility,
        pinned_weapon: payload.pinnedWeaponId,
        pinned_armor: payload.pinnedArmorId,
        updated_at: now,
      },
      { onConflict: "discord_user_id" },
    )
    .select("*")
    .single();

  if (error) throw error;
  return {
    ...data,
    badges: Array.isArray((data as any).badges) ? (data as any).badges : [],
  } as StalcraftProfileShowcaseRow;
}

export async function linkStalcraftProfileFromCode(discordUserId: string, code: string) {
  const tokens = await exchangeStalcraftCode(code);
  const user = await fetchExboUser(tokens.access_token);
  const now = new Date().toISOString();

  const row = {
    discord_user_id: discordUserId,
    exbo_id: String(user.id),
    exbo_uuid: user.uuid || null,
    exbo_login: user.login || null,
    exbo_display_login: user.display_login || user.login || null,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token || null,
    token_type: tokens.token_type || "Bearer",
    token_expires_at: tokenExpiry(tokens.expires_in || 3600),
    updated_at: now,
    linked_at: now,
  };

  const { error } = await requireSupabase().from("sc_players").upsert(row, { onConflict: "discord_user_id" });
  if (error) throw error;

  return syncStalcraftCharacters(discordUserId);
}

export async function ensureFreshStalcraftAccessToken(profile: StalcraftProfileRow) {
  if (!profile.access_token) throw new Error("STALCRAFT profile has no access token.");

  const expiresAt = profile.token_expires_at ? new Date(profile.token_expires_at).getTime() : 0;
  if (!profile.refresh_token || expiresAt > Date.now() + 60_000) {
    return profile.access_token;
  }

  const tokens = await refreshStalcraftToken(profile.refresh_token);
  const now = new Date().toISOString();

  const { error } = await requireSupabase()
    .from("sc_players")
    .update({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || profile.refresh_token,
      token_type: tokens.token_type || profile.token_type || "Bearer",
      token_expires_at: tokenExpiry(tokens.expires_in || 3600),
      updated_at: now,
    })
    .eq("discord_user_id", profile.discord_user_id);

  if (error) throw error;
  return tokens.access_token;
}

export async function syncStalcraftCharacters(discordUserId: string) {
  const profile = await getStalcraftProfile(discordUserId);
  if (!profile) throw new Error("STALCRAFT profile is not linked.");

  const accessToken = await ensureFreshStalcraftAccessToken(profile);
  const characterRows: StalcraftCharacterCacheRow[] = [];
  let savedCharacterRows: StalcraftCharacterCacheRow[] = [];
  const failures: string[] = [];

  for (const region of STALCRAFT_REGIONS) {
    try {
      const rows = await fetchStalcraftCharacters(region, accessToken);
      characterRows.push(...rows.map((row) => ({ ...row, discord_user_id: discordUserId })));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${region}: ${message}`);
      console.warn(`[stalcraft] character sync failed for ${region}:`, message);
    }
  }

  if (characterRows.length === 0 && failures.length > 0) {
    throw new Error(`Не удалось считать персонажей STALCRAFT. ${failures.join(" | ")}`);
  }

  if (characterRows.length > 0) {
    let writableCharacterRows = characterRows.map((row) => ({
      ...row,
      clan_id: cleanOptionalText(row.clan_id),
      clan_name: cleanOptionalText(row.clan_name),
    }));
    const clanRows = buildClanRowsFromCharacters(characterRows);
    if (clanRows.length > 0) {
      const supabase = requireSupabase();
      const { error: clanError } = await supabase.from("sc_clans").upsert(clanRows, { onConflict: "clan_id" });
      if (clanError) throw clanError;

      const { data: persistedClans } = await supabase
        .from("sc_clans")
        .select("clan_id")
        .in("clan_id", clanRows.map((r) => r.clan_id));
      const knownClanIds = new Set((persistedClans || []).map((r: any) => String(r.clan_id)));
      writableCharacterRows = writableCharacterRows.map((row) => ({
        ...row,
        clan_id: row.clan_id && knownClanIds.has(row.clan_id) ? row.clan_id : null,
      }));
    }

    const supabase = requireSupabase();
    const memberRows = buildClanMemberRowsFromCharacters(discordUserId, writableCharacterRows);
    if (memberRows.length > 0) {
      const { error: memberError } = await supabase.from("sc_clan_members").upsert(memberRows, { onConflict: "clan_id,discord_user_id" });
      if (memberError) throw memberError;
    }

    const accessRows = buildClanAccessRowsFromCharacters(discordUserId, writableCharacterRows);
    if (accessRows.length > 0) {
      const { error: accessError } = await supabase.from("sc_clan_access").upsert(accessRows, { onConflict: "clan_id,discord_user_id" });
      if (accessError) throw accessError;
    }

    const { error } = await supabase.from("sc_character_cache").upsert(writableCharacterRows, { onConflict: "discord_user_id,region,character_id" });
    if (error) throw error;

    await syncRegisteredFriends(discordUserId, writableCharacterRows).catch((e) => {
      console.warn("[stalcraft] registered friends sync skipped:", e instanceof Error ? e.message : e);
    });
    savedCharacterRows = writableCharacterRows;

    if (profile.selected_character_id) {
      const selectedRow = writableCharacterRows.find(
        (row) => row.character_id === profile.selected_character_id && row.region === profile.selected_region,
      );
      if (selectedRow) {
        await syncApiEquipmentSnapshot(discordUserId, selectedRow.character_id, selectedRow.raw).catch((caught) => {
          console.warn("[stalcraft] equipment sync skipped:", caught instanceof Error ? caught.message : caught);
        });
      }
    }
  }

  return savedCharacterRows.length > 0 ? savedCharacterRows : characterRows;
}

export async function listStalcraftCharacters(discordUserId: string) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("sc_character_cache")
    .select("*")
    .eq("discord_user_id", discordUserId)
    .order("region")
    .order("character_name");

  if (error) throw error;
  return (data || []) as StalcraftCharacterCacheRow[];
}

export async function selectStalcraftCharacter(discordUserId: string, region: StalcraftRegion, characterId: string) {
  const supabase = requireSupabase();
  const { data: character, error: characterError } = await supabase
    .from("sc_character_cache")
    .select("*")
    .eq("discord_user_id", discordUserId)
    .eq("region", region)
    .eq("character_id", characterId)
    .maybeSingle();

  if (characterError) throw characterError;
  if (!character) throw new Error("Character was not found in your STALCRAFT account.");

  const row = character as StalcraftCharacterCacheRow;
  const { error } = await supabase
    .from("sc_players")
    .update({
      selected_region: region,
      selected_character_id: row.character_id,
      selected_character_name: row.character_name,
      selected_clan_id: row.clan_id,
      selected_clan_name: row.clan_name,
      selected_clan_rank: row.clan_rank,
      updated_at: new Date().toISOString(),
    })
    .eq("discord_user_id", discordUserId);

  if (error) throw error;
  await syncApiEquipmentSnapshot(discordUserId, row.character_id, row.raw).catch((caught) => {
    console.warn("[stalcraft] equipment sync on character select skipped:", caught instanceof Error ? caught.message : caught);
  });
  return row;
}

export async function unlinkStalcraftProfile(discordUserId: string) {
  const supabase = requireSupabase();
  const [{ error: profileError }, { error: cacheError }] = await Promise.all([
    supabase.from("sc_players").delete().eq("discord_user_id", discordUserId),
    supabase.from("sc_character_cache").delete().eq("discord_user_id", discordUserId),
  ]);

  if (profileError) throw profileError;
  if (cacheError) throw cacheError;
}

export async function getStalcraftGuildSettings(guildId: string) {
  const supabase = requireSupabase();
  const { data, error } = await supabase.from("sc_guild_settings").select("*").eq("guild_id", guildId).maybeSingle();
  if (error) throw error;
  return (data || null) as StalcraftGuildSettingsRow | null;
}

export async function saveStalcraftGuildSettings(
  guildId: string,
  discordUserId: string,
  payload: {
    enabled: boolean;
    commandsEnabled: boolean;
    autoSyncRoles: boolean;
    communityName: string | null;
    requiredClanId: string | null;
    requiredClanName: string | null;
    verifiedRoleId: string | null;
    verifiedRoleName: string;
    roleAutoCreate: boolean;
  },
) {
  const supabase = requireSupabase();
  const now = new Date().toISOString();
  const profile = await getStalcraftProfile(discordUserId);

  if (payload.enabled && !profile?.selected_character_id) {
    throw new Error("Перед включением STALCRAFT-сервера привяжи EXBO-профиль и выбери персонажа.");
  }

  const { data, error } = await supabase
    .from("sc_guild_settings")
    .upsert(
      {
        guild_id: guildId,
        enabled: payload.enabled,
        commands_enabled: payload.commandsEnabled,
        auto_sync_roles: payload.autoSyncRoles,
        community_name: payload.communityName || profile?.selected_clan_name || profile?.selected_character_name || null,
        clan_id: payload.requiredClanId || profile?.selected_clan_id || null,
        clan_name: payload.requiredClanName || profile?.selected_clan_name || null,
        required_clan_id: payload.requiredClanId || profile?.selected_clan_id || null,
        required_clan_name: payload.requiredClanName || profile?.selected_clan_name || null,
        verified_role_id: payload.verifiedRoleId,
        verified_role_name: payload.verifiedRoleName || "STALCRAFT Verified",
        role_auto_create: payload.roleAutoCreate,
        updated_by: discordUserId,
        updated_at: now,
      },
      { onConflict: "guild_id" },
    )
    .select("*")
    .single();

  if (error) throw error;

  await supabase.from("sc_logs").insert({
    guild_id: guildId,
    event_type: "settings.updated",
    actor_discord_user_id: discordUserId,
    title: "STALCRAFT settings updated",
    message: "Dashboard saved STALCRAFT guild settings.",
    payload: {
      stalcraftEnabled: payload.enabled,
      autoSyncRoles: payload.autoSyncRoles,
      requiredClanName: payload.requiredClanName || profile?.selected_clan_name || null,
    },
  });

  return data as StalcraftGuildSettingsRow;
}

export async function listRegisteredStalcraftFriends(discordUserId: string) {
  const supabase = requireSupabase();
  const { data: links, error } = await supabase
    .from("sc_friends")
    .select("friend_discord_user_id, game_friend_name, synced_at")
    .eq("discord_user_id", discordUserId)
    .order("synced_at", { ascending: false });

  if (error) return [];
  const ids = (links || []).map((row: any) => row.friend_discord_user_id).filter(Boolean);
  if (ids.length === 0) return [];

  const { data: players } = await supabase
    .from("sc_players")
    .select("discord_user_id, exbo_display_login, selected_character_name, selected_region, selected_clan_name, selected_clan_rank, synced_at")
    .in("discord_user_id", ids);

  const playersById = new Map((players || []).map((row: any) => [row.discord_user_id, row]));
  return (links || []).map((link: any) => ({
    ...link,
    player: playersById.get(link.friend_discord_user_id) || null,
  }));
}

export async function listStalcraftEquipment(discordUserId: string, characterId?: string | null) {
  const supabase = requireSupabase();
  let query = supabase
    .from("sc_equipment")
    .select("*")
    .eq("discord_user_id", discordUserId)
    .order("slot")
    .order("updated_at", { ascending: false });

  if (characterId) query = query.eq("character_id", characterId);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function deleteStalcraftEquipment(discordUserId: string, equipmentId: string) {
  const supabase = requireSupabase();
  const { data: deleted, error } = await supabase
    .from("sc_equipment")
    .delete()
    .eq("discord_user_id", discordUserId)
    .eq("id", equipmentId)
    .select("id, slot, source")
    .maybeSingle();

  if (error) throw error;
  if (!deleted) throw new Error("Снаряжение не найдено или уже удалено.");
  return deleted;
}

export async function listEnabledStalcraftCommunities() {
  const supabase = requireSupabase();
  const { data: settings, error } = await supabase
    .from("sc_guild_settings")
    .select("guild_id, community_name, clan_id, clan_name, required_clan_id, required_clan_name, verified_role_name, updated_at")
    .eq("enabled", true)
    .order("updated_at", { ascending: false })
    .limit(80);

  if (error) throw error;

  const rows = ((settings || []) as Array<{
    guild_id: string;
    community_name: string | null;
    clan_id: string | null;
    clan_name: string | null;
    required_clan_id: string | null;
    required_clan_name: string | null;
    verified_role_name: string | null;
    updated_at: string | null;
  }>).filter((row) => row.clan_id || row.required_clan_id || row.clan_name || row.required_clan_name);

  if (rows.length === 0) return [] as StalcraftCommunityRow[];

  const guildIds = rows.map((row) => row.guild_id);
  const { data: guilds } = await supabase.from("sc_guilds").select("guild_id, name, icon").in("guild_id", guildIds);

  const guildById = new Map(((guilds || []) as Array<{ guild_id: string; name: string | null; icon: string | null }>).map((g) => [g.guild_id, g]));

  return rows.map((row) => {
    const guild = guildById.get(row.guild_id);
    return {
      guild_id: row.guild_id,
      guild_name: guild?.name || null,
      guild_icon: guild?.icon || null,
      community_name: row.community_name,
      required_clan_name: row.required_clan_name || row.clan_name,
      verified_role_name: row.verified_role_name,
      updated_at: row.updated_at,
    } satisfies StalcraftCommunityRow;
  });
}
