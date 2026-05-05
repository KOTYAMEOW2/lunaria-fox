"use client";

import { startTransition, useMemo, useState } from "react";
import type {
  StalcraftCharacterCacheRow,
  StalcraftProfileRow,
  StalcraftProfileShowcaseRow,
} from "@/lib/stalcraft/types";

type EquipmentRow = {
  id: string;
  character_id: string | null;
  slot: string;
  item_name: string;
  item_rank: string | null;
  item_category: string | null;
  source: string | null;
  verified_by?: string | null;
  verified_at?: string | null;
  raw?: Record<string, unknown> | null;
  updated_at: string | null;
};

type OfficialGearSearchResult = {
  itemId: string;
  itemName: string;
  itemNameRu?: string | null;
  itemNameEn?: string | null;
  slot: "weapon" | "armor";
  category: string;
  rank: string | null;
  wikiUrl: string;
  exact: boolean;
  score: number;
};

type Props = {
  profile: StalcraftProfileRow | null;
  showcase: StalcraftProfileShowcaseRow | null;
  characters: StalcraftCharacterCacheRow[];
  equipment: EquipmentRow[];
  friends: Array<{
    friend_discord_user_id: string;
    game_friend_name: string | null;
    synced_at: string | null;
    player: {
      exbo_display_login: string | null;
      selected_character_name: string | null;
      selected_region: string | null;
      selected_clan_name: string | null;
      selected_clan_rank: string | null;
      synced_at: string | null;
    } | null;
  }>;
};

function getEquipmentWikiUrl(item: EquipmentRow) {
  const raw = item.raw;
  if (!raw || typeof raw !== "object") return null;
  const value = raw.wiki_url;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getEquipmentVerificationMode(item: EquipmentRow) {
  if (item.source === "screenshot") return "screenshot_verified";
  const raw = item.raw;
  const manualMode =
    raw && typeof raw === "object" && typeof raw.verification_mode === "string"
      ? String(raw.verification_mode)
      : null;

  if (item.source === "api") return "api_confirmed";
  if (manualMode) return manualMode;
  if (item.verified_at) return "api_confirmed";
  return "self_reported_manual";
}

function isShowcaseEquipment(item: EquipmentRow) {
  return item.source === "api" || item.verified_by === "official-database" || Boolean(item.verified_at);
}

function getEquipmentOriginLabel(item: EquipmentRow) {
  const mode = getEquipmentVerificationMode(item);
  if (mode === "screenshot_verified") return "Скрин · bot OCR";
  if (item.source === "api" || mode === "api_confirmed") return "API подтверждение";
  if (mode === "self_reported_no_api") return "Ручное · API не отдал снаряжение";
  if (mode === "self_reported_manual") return "Ручное · по оф. базе";
  return "Ручное подтверждение";
}

function getEquipmentShortSource(item: EquipmentRow) {
  if (item.source === "api") return "API";
  if (item.source === "screenshot") return "скрин";
  return "ручное";
}

function pickCharacterEquipmentId(rows: EquipmentRow[], slot: "weapon" | "armor") {
  const filtered = rows.filter((item) => item.slot === slot);
  const manual = filtered.find((item) => item.source === "manual");
  const manualSourceId = manual?.raw && typeof manual.raw === "object"
    ? String((manual.raw as Record<string, unknown>).source_equipment_id || "")
    : "";
  if (manualSourceId) return manualSourceId;
  return filtered.find((item) => item.source === "api")?.id || "";
}

function formatFactionName(value: string | null | undefined) {
  const raw = String(value || "").trim();
  if (!raw) return null;

  const normalized = raw.toLowerCase();
  if (normalized === "covenant") return "Завет";
  if (normalized === "frontier") return "Рубеж";
  if (normalized === "mercenaries" || normalized === "mercs") return "Наёмники";
  if (normalized === "rise") return "Восход";
  if (normalized === "stalkers") return "Сталкеры";
  if (normalized === "bandits") return "Бандиты";
  if (normalized === "freedom") return "Свобода";
  if (normalized === "duty") return "Долг";
  return raw;
}

export function StalcraftProfileClient({ profile, showcase, characters, equipment, friends }: Props) {
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState(profile?.selected_character_id || "");
  const [equipmentRows, setEquipmentRows] = useState(equipment || []);
  const [showcaseForm, setShowcaseForm] = useState({
    title: showcase?.title || "",
    bio: showcase?.bio || "",
    visibility: showcase?.visibility || "clan",
    pinnedWeaponId: showcase?.pinned_weapon || "",
    pinnedArmorId: showcase?.pinned_armor || "",
  });
  const currentCharacterId = selected || profile?.selected_character_id || "";

  const selectedCharacterEquipment = useMemo(
    () => equipmentRows.filter((item) => item.character_id === currentCharacterId),
    [currentCharacterId, equipmentRows],
  );

  const showcaseEquipment = useMemo(
    () => equipmentRows.filter((item) => isShowcaseEquipment(item)),
    [equipmentRows],
  );
  const selectedApiEquipment = useMemo(
    () => selectedCharacterEquipment.filter((item) => item.source === "api"),
    [selectedCharacterEquipment],
  );
  const apiWeaponOptions = useMemo(
    () => selectedApiEquipment.filter((item) => item.slot === "weapon"),
    [selectedApiEquipment],
  );
  const apiArmorOptions = useMemo(
    () => selectedApiEquipment.filter((item) => item.slot === "armor"),
    [selectedApiEquipment],
  );

  const weaponOptions = useMemo(
    () => showcaseEquipment.filter((item) => item.slot === "weapon"),
    [showcaseEquipment],
  );
  const armorOptions = useMemo(
    () => showcaseEquipment.filter((item) => item.slot === "armor"),
    [showcaseEquipment],
  );

  const showcasePinnedWeapon = equipmentRows.find((item) => item.id === showcaseForm.pinnedWeaponId) || null;
  const showcasePinnedArmor = equipmentRows.find((item) => item.id === showcaseForm.pinnedArmorId) || null;

  const [gearForm, setGearForm] = useState({
    weapon: pickCharacterEquipmentId(selectedCharacterEquipment, "weapon"),
    armor: pickCharacterEquipmentId(selectedCharacterEquipment, "armor"),
  });
  const [manualQuery, setManualQuery] = useState<{ weapon: string; armor: string }>({
    weapon: "",
    armor: "",
  });
  const [manualResults, setManualResults] = useState<{ weapon: OfficialGearSearchResult[]; armor: OfficialGearSearchResult[] }>({
    weapon: [],
    armor: [],
  });
  const [manualLoading, setManualLoading] = useState<{ weapon: boolean; armor: boolean }>({
    weapon: false,
    armor: false,
  });

  async function selectCharacter(value: string) {
    const [region, characterId] = value.split(":");
    setSelected(characterId);
    setStatus("Сохраняю персонажа...");
    const response = await fetch("/api/stalcraft/characters/select", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ region, characterId }),
    });
    const payload = await response.json().catch(() => ({}));
    setStatus(response.ok ? "Персонаж выбран." : payload.error || "Ошибка выбора персонажа.");
    if (response.ok) startTransition(() => window.location.reload());
  }

  async function syncCharacters() {
    setStatus("Обновляю персонажей и пытаюсь подтянуть снаряжение из API...");
    const response = await fetch("/api/stalcraft/characters/sync", { method: "POST" });
    const payload = await response.json().catch(() => ({}));
    setStatus(response.ok ? "Персонажи обновлены. Если gear не появился, его можно указать вручную по официальной базе." : payload.error || "Ошибка синхронизации.");
    if (response.ok) startTransition(() => window.location.reload());
  }

  async function unlink() {
    setStatus("Отвязываю профиль...");
    const response = await fetch("/api/stalcraft/unlink", { method: "POST" });
    const payload = await response.json().catch(() => ({}));
    setStatus(response.ok ? "Профиль отвязан." : payload.error || "Ошибка отвязки.");
    if (response.ok) startTransition(() => window.location.reload());
  }

  async function saveShowcase() {
    setStatus("Сохраняю профиль игрока...");
    const response = await fetch("/api/stalcraft/showcase", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: showcaseForm.title || null,
        bio: showcaseForm.bio || null,
        visibility: showcaseForm.visibility,
        pinnedWeaponId: showcaseForm.pinnedWeaponId || null,
        pinnedArmorId: showcaseForm.pinnedArmorId || null,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    setStatus(response.ok ? "Профиль игрока сохранён." : payload.error || "Ошибка сохранения профиля.");
  }

  async function saveGear(slot: "weapon" | "armor") {
    const equipmentId = gearForm[slot].trim();
    if (!equipmentId) {
      setStatus("Сначала выбери предмет из найденного API-снаряжения.");
      return;
    }

    setStatus("Подтверждаю снаряжение из API...");
    const response = await fetch("/api/stalcraft/equipment", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        slot,
        equipmentId,
        itemRank: "master",
        itemCategory: slot,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setStatus(payload.error || "Ошибка сохранения снаряжения.");
      return;
    }

    setEquipmentRows((current) => [
      payload.equipment,
      ...current.filter((item) => item.id !== payload.equipment.id && !(item.character_id === payload.equipment.character_id && item.slot === payload.equipment.slot && item.source === "manual")),
    ]);
    setGearForm((current) => ({ ...current, [slot]: equipmentId }));
    setStatus(`Снаряжение уточнено: ${payload.equipment.item_name}.`);
  }

  async function searchManualGear(slot: "weapon" | "armor") {
    const query = manualQuery[slot].trim();
    if (query.length < 2) {
      setStatus("Для поиска по официальной базе введи хотя бы 2 символа.");
      setManualResults((current) => ({ ...current, [slot]: [] }));
      return;
    }

    setManualLoading((current) => ({ ...current, [slot]: true }));
    const response = await fetch(`/api/stalcraft/equipment/search?slot=${slot}&limit=6&q=${encodeURIComponent(query)}`);
    const payload = await response.json().catch(() => ({}));
    setManualLoading((current) => ({ ...current, [slot]: false }));

    if (!response.ok) {
      setManualResults((current) => ({ ...current, [slot]: [] }));
      setStatus(payload.error || "Не удалось найти предмет в официальной базе.");
      return;
    }

    const results = Array.isArray(payload.results) ? payload.results : [];
    setManualResults((current) => ({ ...current, [slot]: results }));
    setStatus(results.length > 0 ? `Найдено ${results.length} предмет(ов) в официальной базе.` : "По этому запросу ничего не найдено.");
  }

  async function saveManualGear(slot: "weapon" | "armor", itemName: string) {
    const cleanName = itemName.trim();
    if (cleanName.length < 2) {
      setStatus("Название предмета слишком короткое.");
      return;
    }

    setStatus("Сохраняю предмет по официальной базе...");
    const response = await fetch("/api/stalcraft/equipment", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        slot,
        itemName: cleanName,
        itemRank: "master",
        itemCategory: slot,
        allowManualFallback: true,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setStatus(payload.error || "Ошибка сохранения предмета.");
      return;
    }

    setEquipmentRows((current) => [
      payload.equipment,
      ...current.filter((item) => item.id !== payload.equipment.id && !(item.character_id === payload.equipment.character_id && item.slot === payload.equipment.slot && item.source === "manual")),
    ]);
    setManualQuery((current) => ({ ...current, [slot]: payload.equipment.item_name }));
    setManualResults((current) => ({ ...current, [slot]: [] }));
    setStatus(`Снаряжение сохранено: ${payload.equipment.item_name}. Если API не отдал вещь, она помечена как ручное подтверждение.`);
  }

  async function deleteGear(item: EquipmentRow) {
    setStatus("Удаляю снаряжение...");
    const response = await fetch("/api/stalcraft/equipment", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ equipmentId: item.id }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setStatus(payload.error || "Ошибка удаления снаряжения.");
      return;
    }

    setEquipmentRows((current) => current.filter((row) => row.id !== item.id));
    setShowcaseForm((current) => ({
      ...current,
      pinnedWeaponId: current.pinnedWeaponId === item.id ? "" : current.pinnedWeaponId,
      pinnedArmorId: current.pinnedArmorId === item.id ? "" : current.pinnedArmorId,
    }));
    if (item.character_id === currentCharacterId && (item.slot === "weapon" || item.slot === "armor")) {
      const slot = item.slot;
      setGearForm((current) => ({ ...current, [slot]: pickCharacterEquipmentId(selectedCharacterEquipment.filter((row) => row.id !== item.id), slot) }));
    }
    setStatus(`Снаряжение удалено: ${item.item_name}.`);
  }

  return (
    <div className="panel">
      <span className="eyebrow">STALCRAFT Account</span>
      <h3>{profile ? "Профиль EXBO привязан" : "Профиль STALCRAFT не привязан"}</h3>
      <p className="muted">
        {profile
          ? `EXBO: ${profile.exbo_display_login || profile.exbo_login || profile.exbo_id}`
          : "Войди через EXBO, чтобы сайт и бот могли подтвердить владение персонажем."}
      </p>

      <div className="stack-actions" style={{ marginTop: 16 }}>
        <a className="primary-button" href="/api/stalcraft/auth/start">
          {profile ? "Перепривязать через EXBO" : "Привязать STALCRAFT"}
        </a>
        {profile ? <button className="secondary-button" onClick={syncCharacters}>Обновить персонажей</button> : null}
        {profile ? <button className="ghost-button" onClick={unlink}>Отвязать</button> : null}
      </div>

      {characters.length > 0 ? (
        <div className="section">
          <h3>Выбранный персонаж для Discord-бота</h3>
          <div className="field">
            <label>Персонаж для `/sc-profile`, `/sc-sync` и клановой синхронизации</label>
            <select value={`${profile?.selected_region || ""}:${currentCharacterId}`} onChange={(event) => selectCharacter(event.target.value)}>
              <option value=":">Не выбран</option>
              {characters.map((character) => (
                <option key={`${character.region}:${character.character_id}`} value={`${character.region}:${character.character_id}`}>
                  [{character.region}] {character.character_name}{character.clan_name ? ` · ${character.clan_name}` : ""}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : profile ? (
        <p className="page-alert">Персонажи пока не найдены. Нажми “Обновить персонажей”.</p>
      ) : null}

      {status ? <p className="page-alert">{status}</p> : null}

      {profile ? (
        <div className="section">
          <div className="dashboard-head">
            <div>
              <span className="eyebrow sc-eyebrow">Player profile</span>
              <h3>Настраиваемый профиль игрока</h3>
              <p className="muted">
                Это профиль аккаунта, а не одного персонажа. Он показывает всех твоих персонажей, их кланы и фракции,
                а оружие и броня для витрины выбираются из сохранённых вещей, подтверждённых API или официальной базой предметов.
              </p>
            </div>
          </div>

          <div className="form-grid">
            <div className="field">
              <label>Заголовок профиля</label>
              <input value={showcaseForm.title} onChange={(event) => setShowcaseForm({ ...showcaseForm, title: event.target.value })} placeholder="Например: Lunaria Fox Vanguard" />
            </div>
            <div className="field">
              <label>Видимость</label>
              <select value={showcaseForm.visibility} onChange={(event) => setShowcaseForm({ ...showcaseForm, visibility: event.target.value as "public" | "clan" | "private" })}>
                <option value="clan">Только клан</option>
                <option value="public">Публичный</option>
                <option value="private">Только я</option>
              </select>
            </div>
          </div>

          <div className="field">
            <label>Описание профиля</label>
            <textarea
              rows={4}
              value={showcaseForm.bio}
              onChange={(event) => setShowcaseForm({ ...showcaseForm, bio: event.target.value })}
              placeholder="Коротко о себе, специализации, роли в клане или любимых персонажах."
            />
          </div>

          <div className="form-grid">
            <div className="field">
              <label>Основное оружие профиля</label>
              <select value={showcaseForm.pinnedWeaponId} onChange={(event) => setShowcaseForm({ ...showcaseForm, pinnedWeaponId: event.target.value })}>
                <option value="">Не выбрано</option>
                {weaponOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.item_name} · {getEquipmentShortSource(item)}{item.character_id ? ` · ${characters.find((character) => character.character_id === item.character_id)?.character_name || item.character_id}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Основная броня профиля</label>
              <select value={showcaseForm.pinnedArmorId} onChange={(event) => setShowcaseForm({ ...showcaseForm, pinnedArmorId: event.target.value })}>
                <option value="">Не выбрано</option>
                {armorOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.item_name} · {getEquipmentShortSource(item)}{item.character_id ? ` · ${characters.find((character) => character.character_id === item.character_id)?.character_name || item.character_id}` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="sc-showcase-preview">
            <article className="activity-card">
              <div className="activity-card-head">
                <span className="badge success">{showcaseForm.visibility}</span>
                <span className="activity-time">{characters.length} char(s)</span>
              </div>
              <strong>{showcaseForm.title || profile.exbo_display_login || profile.selected_character_name || "STALCRAFT Player"}</strong>
              <p>{showcaseForm.bio || "Профиль аккаунта настроен минимально. Добавь описание, чтобы витрина выглядела живее."}</p>
              <p>
                Оружие: {showcasePinnedWeapon?.item_name || "не выбрано"}
                <br />
                Броня: {showcasePinnedArmor?.item_name || "не выбрана"}
              </p>
            </article>
          </div>

          <div className="stack-actions" style={{ marginTop: 16 }}>
            <button className="secondary-button sc-secondary" onClick={saveShowcase} type="button">
              Сохранить профиль игрока
            </button>
          </div>
        </div>
      ) : null}

      {profile ? (
        <div className="section">
          <div className="dashboard-head">
            <div>
              <span className="eyebrow sc-eyebrow">Account characters</span>
              <h3>Все персонажи аккаунта</h3>
              <p className="muted">
                Здесь видны все персонажи, привязанные к текущему EXBO-аккаунту, их кланы, ранги, фракции и сохранённое снаряжение.
              </p>
            </div>
            <span className="badge muted">{characters.length} char(s)</span>
          </div>
          <div className="sc-character-grid">
            {characters.map((character) => {
              const characterItems = equipmentRows.filter((item) => item.character_id === character.character_id);
              return (
                <article className="activity-card sc-character-card" key={`${character.region}:${character.character_id}`}>
                  <div className="activity-card-head">
                    <span className="badge success">{character.region}</span>
                    <span className="activity-time">{profile.selected_character_id === character.character_id ? "bot selected" : "account"}</span>
                  </div>
                  <strong>{character.character_name}</strong>
                  <div className="sc-character-meta">
                    <span>Клан: {character.clan_name || "без клана"}</span>
                    <span>Ранг: {character.clan_rank || "не указан"}</span>
                    <span>Фракция: {formatFactionName(character.clan_alliance) || "не указана"}</span>
                  </div>
                  <div className="sc-character-gear-list">
                    {characterItems.length > 0 ? characterItems.map((item) => (
                      <div className="sc-character-gear-item" key={item.id}>
                        <span>{item.slot}</span>
                        <strong>{item.item_name}</strong>
                        <small>{getEquipmentOriginLabel(item)}</small>
                      </div>
                    )) : <p className="panel-note">Снаряжение по этому персонажу пока не найдено.</p>}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      ) : null}

      {profile?.selected_character_id ? (
        <div className="section">
          <div className="dashboard-head">
            <div>
              <span className="eyebrow sc-eyebrow">Readiness gear</span>
              <h3>Уточнение снаряжения выбранного персонажа</h3>
              <p className="muted">
                Сначала сайт пытается вытащить вещи из доступного STALCRAFT API. Если gear не пришёл или пришёл не полностью,
                ниже можно выбрать предмет вручную по официальной базе EXBO. Такие записи помечаются как ручные.
              </p>
            </div>
            <span className="badge muted">{selectedCharacterEquipment.length} item(s)</span>
          </div>
          <div className="form-grid">
            <div className="field">
              <label>Оружие выбранного персонажа</label>
              <select value={gearForm.weapon} onChange={(event) => setGearForm({ ...gearForm, weapon: event.target.value })}>
                <option value="">Выбери найденное оружие</option>
                {apiWeaponOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.item_name}
                  </option>
                ))}
              </select>
              <p className="panel-note">
                {apiWeaponOptions.length > 0
                  ? "Это то, что удалось найти в raw payload API для выбранного персонажа."
                  : "API пока не отдал оружие в читаемом виде. Используй поиск по официальной базе ниже."}
              </p>
              <button className="secondary-button sc-secondary" disabled={!gearForm.weapon} onClick={() => saveGear("weapon")} type="button">Подтвердить оружие</button>
            </div>
            <div className="field">
              <label>Броня выбранного персонажа</label>
              <select value={gearForm.armor} onChange={(event) => setGearForm({ ...gearForm, armor: event.target.value })}>
                <option value="">Выбери найденную броню</option>
                {apiArmorOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.item_name}
                  </option>
                ))}
              </select>
              <p className="panel-note">
                {apiArmorOptions.length > 0
                  ? "Если здесь не хватает нужной брони, её можно сохранить вручную по официальной базе."
                  : "API пока не отдал броню в читаемом виде. Используй поиск по официальной базе ниже."}
              </p>
              <button className="secondary-button sc-secondary" disabled={!gearForm.armor} onClick={() => saveGear("armor")} type="button">Подтвердить броню</button>
            </div>
          </div>
          <div className="form-grid">
            {(["weapon", "armor"] as const).map((slot) => (
              <div className="field sc-gear-manual-field" key={`manual-${slot}`}>
                <label>{slot === "weapon" ? "Ручной поиск оружия по оф. базе" : "Ручной поиск брони по оф. базе"}</label>
                <div className="sc-gear-manual-row">
                  <input
                    value={manualQuery[slot]}
                    onChange={(event) => setManualQuery((current) => ({ ...current, [slot]: event.target.value }))}
                    placeholder={slot === "weapon" ? "Например: FN F2000 Tactical" : "Например: Сатурн / Центурион / SBA TANK"}
                  />
                  <button
                    className="ghost-button"
                    disabled={manualLoading[slot]}
                    onClick={() => searchManualGear(slot)}
                    type="button"
                  >
                    {manualLoading[slot] ? "Поиск..." : "Найти"}
                  </button>
                </div>
                <p className="panel-note">
                  Поиск идёт по официальной базе предметов EXBO. Если API не дал вещь, сайт сохранит её как ручное подтверждение.
                </p>
                {manualResults[slot].length > 0 ? (
                  <div className="sc-gear-search-results">
                    {manualResults[slot].map((item) => (
                      <article className="sc-gear-search-item" key={`${slot}-${item.itemId}`}>
                        <div>
                          <strong>{item.itemName}</strong>
                          <p>{item.rank || "rank?"} · {item.category}</p>
                        </div>
                        <div className="sc-gear-search-actions">
                          <a className="inline-link" href={item.wikiUrl} target="_blank" rel="noreferrer">
                            wiki
                          </a>
                          <button className="secondary-button sc-secondary" onClick={() => saveManualGear(slot, item.itemName)} type="button">
                            Сохранить
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
          <div className="sc-gear-grid">
            {selectedCharacterEquipment.length > 0 ? selectedCharacterEquipment.map((item) => (
              <article className="activity-card" key={item.id || `${item.slot}-${item.item_name}`}>
                <div className="activity-card-head">
                  <span className="badge success">{item.slot}</span>
                  <span className="activity-time">{item.source === "api" ? "API" : "manual"}</span>
                </div>
                <strong>{item.item_name}</strong>
                <p>{item.item_rank || "master"} · {item.item_category || item.slot}</p>
                <div className="sc-gear-meta-row">
                  <span className="badge muted">{getEquipmentOriginLabel(item)}</span>
                  {getEquipmentWikiUrl(item) ? (
                    <a className="inline-link" href={getEquipmentWikiUrl(item) || "#"} target="_blank" rel="noreferrer">
                      Открыть на stalcraft.wiki
                    </a>
                  ) : null}
                </div>
                <div className="sc-gear-actions">
                  <button className="ghost-button sc-gear-delete" onClick={() => deleteGear(item)} type="button">
                    Удалить
                  </button>
                </div>
              </article>
            )) : <p className="panel-note">Снаряжение для выбранного персонажа пока не указано.</p>}
          </div>
        </div>
      ) : null}

      {profile ? (
        <div className="section">
          <div className="dashboard-head">
            <div>
              <span className="eyebrow sc-eyebrow">Registered friends</span>
              <h3>Друзья STALCRAFT, которые уже есть в Lunaria Fox</h3>
              <p className="muted">
                Список строится только из тех друзей, которых EXBO отдаёт в профиле и которые тоже привязали аккаунт на сайте.
              </p>
            </div>
            <span className="badge muted">{friends.length} friend(s)</span>
          </div>
          <div className="sc-friends-grid">
            {friends.length > 0 ? friends.map((friend) => (
              <article className="activity-card" key={friend.friend_discord_user_id}>
                <div className="activity-card-head">
                  <span className="badge success">registered</span>
                  <span className="activity-time">{friend.player?.selected_region || "SC"}</span>
                </div>
                <strong>{friend.player?.selected_character_name || friend.game_friend_name || friend.player?.exbo_display_login || friend.friend_discord_user_id}</strong>
                <p>
                  {friend.player?.selected_clan_name || "Клан не выбран"}
                  {friend.player?.selected_clan_rank ? ` · ${friend.player.selected_clan_rank}` : ""}
                </p>
              </article>
            )) : (
              <p className="panel-note">
                Зарегистрированные друзья пока не найдены. Если EXBO не отдаёт список друзей в OAuth-профиле, бот покажет только тех,
                кого удалось сопоставить через доступные данные API.
              </p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
