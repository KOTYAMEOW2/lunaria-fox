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

function isVerifiedEquipment(item: EquipmentRow) {
  return item.source === "api" || Boolean(item.verified_at);
}

function pickCharacterItemName(rows: EquipmentRow[], slot: "weapon" | "armor") {
  const filtered = rows.filter((item) => item.slot === slot);
  const preferred = filtered.find((item) => item.source === "manual") || filtered[0];
  return preferred?.item_name || "";
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

  const verifiedEquipment = useMemo(
    () => equipmentRows.filter((item) => isVerifiedEquipment(item)),
    [equipmentRows],
  );

  const weaponOptions = useMemo(
    () => verifiedEquipment.filter((item) => item.slot === "weapon"),
    [verifiedEquipment],
  );
  const armorOptions = useMemo(
    () => verifiedEquipment.filter((item) => item.slot === "armor"),
    [verifiedEquipment],
  );

  const showcasePinnedWeapon = equipmentRows.find((item) => item.id === showcaseForm.pinnedWeaponId) || null;
  const showcasePinnedArmor = equipmentRows.find((item) => item.id === showcaseForm.pinnedArmorId) || null;

  const [gearForm, setGearForm] = useState({
    weapon: pickCharacterItemName(selectedCharacterEquipment, "weapon"),
    armor: pickCharacterItemName(selectedCharacterEquipment, "armor"),
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
    setStatus("Обновляю персонажей и снаряжение...");
    const response = await fetch("/api/stalcraft/characters/sync", { method: "POST" });
    const payload = await response.json().catch(() => ({}));
    setStatus(response.ok ? "Персонажи и снаряжение обновлены." : payload.error || "Ошибка синхронизации.");
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
    const itemName = gearForm[slot].trim();
    if (!itemName) {
      setStatus("Название предмета обязательно.");
      return;
    }

    setStatus("Сохраняю уточнение снаряжения...");
    const response = await fetch("/api/stalcraft/equipment", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        slot,
        itemName,
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
    setGearForm((current) => ({ ...current, [slot]: payload.equipment.item_name }));
    setStatus(`Снаряжение уточнено: ${payload.equipment.item_name}.`);
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
      setGearForm((current) => ({ ...current, [item.slot]: "" }));
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
                Это профиль аккаунта, а не одного персонажа. Он показывает всех твоих персонажей, их кланы и альянсы,
                а оружие и броня для витрины выбираются только из подтверждённых API-предметов.
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
                    {item.item_name}{item.character_id ? ` · ${characters.find((character) => character.character_id === item.character_id)?.character_name || item.character_id}` : ""}
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
                    {item.item_name}{item.character_id ? ` · ${characters.find((character) => character.character_id === item.character_id)?.character_name || item.character_id}` : ""}
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
                Здесь видны все персонажи, привязанные к текущему EXBO-аккаунту, их кланы, ранги и альянсы.
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
                    <span>Альянс/фракция: {character.clan_alliance || "не указан"}</span>
                  </div>
                  <div className="sc-character-gear-list">
                    {characterItems.length > 0 ? characterItems.map((item) => (
                      <div className="sc-character-gear-item" key={item.id}>
                        <span>{item.slot}</span>
                        <strong>{item.item_name}</strong>
                        <small>{item.source || "manual"}{item.verified_at ? " · verified" : ""}</small>
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
                Подтверждение проходит только если такой предмет уже был найден у выбранного персонажа через STALCRAFT API.
                То есть сюда больше нельзя вписать вещь, которой у игрока нет.
              </p>
            </div>
            <span className="badge muted">{selectedCharacterEquipment.length} item(s)</span>
          </div>
          <div className="form-grid">
            <div className="field">
              <label>Оружие выбранного персонажа</label>
              <input value={gearForm.weapon} onChange={(event) => setGearForm({ ...gearForm, weapon: event.target.value })} placeholder="Например: FN F2000 Tactical" />
              <button className="secondary-button sc-secondary" onClick={() => saveGear("weapon")} type="button">Подтвердить оружие</button>
            </div>
            <div className="field">
              <label>Броня выбранного персонажа</label>
              <input value={gearForm.armor} onChange={(event) => setGearForm({ ...gearForm, armor: event.target.value })} placeholder="Например: Сатурн / Танк / Центурион" />
              <button className="secondary-button sc-secondary" onClick={() => saveGear("armor")} type="button">Подтвердить броню</button>
            </div>
          </div>
          <div className="sc-gear-grid">
            {selectedCharacterEquipment.length > 0 ? selectedCharacterEquipment.map((item) => (
              <article className="activity-card" key={item.id || `${item.slot}-${item.item_name}`}>
                <div className="activity-card-head">
                  <span className="badge success">{item.slot}</span>
                  <span className="activity-time">{item.source || "manual"}</span>
                </div>
                <strong>{item.item_name}</strong>
                <p>{item.item_rank || "master"} · {item.item_category || item.slot}</p>
                <div className="sc-gear-meta-row">
                  {item.verified_at ? <span className="badge muted">verified</span> : <span className="badge muted">unverified</span>}
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
