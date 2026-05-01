"use client";

import { useState, startTransition } from "react";
import type { StalcraftCharacterCacheRow, StalcraftProfileRow } from "@/lib/stalcraft/types";

type Props = {
  profile: StalcraftProfileRow | null;
  characters: StalcraftCharacterCacheRow[];
  equipment: Array<{
    id: string;
    slot: string;
    item_name: string;
    item_rank: string | null;
    item_category: string | null;
    source: string | null;
    updated_at: string | null;
  }>;
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

export function StalcraftProfileClient({ profile, characters, equipment, friends }: Props) {
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState(profile?.selected_character_id || "");
  const [equipmentRows, setEquipmentRows] = useState(equipment || []);
  const [gearForm, setGearForm] = useState({
    weapon: equipment.find((item) => item.slot === "weapon")?.item_name || "",
    armor: equipment.find((item) => item.slot === "armor")?.item_name || "",
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
    setStatus("Обновляю список персонажей...");
    const response = await fetch("/api/stalcraft/characters/sync", { method: "POST" });
    const payload = await response.json().catch(() => ({}));
    setStatus(response.ok ? "Список обновлён." : payload.error || "Ошибка синхронизации.");
    if (response.ok) startTransition(() => window.location.reload());
  }

  async function unlink() {
    setStatus("Отвязываю профиль...");
    const response = await fetch("/api/stalcraft/unlink", { method: "POST" });
    const payload = await response.json().catch(() => ({}));
    setStatus(response.ok ? "Профиль отвязан." : payload.error || "Ошибка отвязки.");
    if (response.ok) startTransition(() => window.location.reload());
  }

  async function saveGear(slot: "weapon" | "armor") {
    const itemName = gearForm[slot].trim();
    if (!itemName) {
      setStatus("Название предмета обязательно.");
      return;
    }

    setStatus("Сохраняю снаряжение...");
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
    setEquipmentRows((current) => [payload.equipment, ...current.filter((item) => item.slot !== slot)]);
    setStatus("Снаряжение сохранено.");
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
          <h3>Выбранный персонаж</h3>
          <div className="field">
            <label>Персонаж для Discord-бота</label>
            <select value={`${profile?.selected_region || ""}:${selected}`} onChange={(event) => selectCharacter(event.target.value)}>
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

      {profile?.selected_character_id ? (
        <div className="section">
          <div className="dashboard-head">
            <div>
              <span className="eyebrow sc-eyebrow">Readiness gear</span>
              <h3>Master-снаряжение для КВ</h3>
              <p className="muted">Если EXBO API не отдаёт инвентарь, укажи оружие и броню вручную. Бот покажет это в `/sc-profile`.</p>
            </div>
            <span className="badge muted">{equipmentRows.length} item(s)</span>
          </div>
          <div className="form-grid">
            <div className="field">
              <label>Master-оружие</label>
              <input value={gearForm.weapon} onChange={(event) => setGearForm({ ...gearForm, weapon: event.target.value })} placeholder="Например: FN F2000 Tactical" />
              <button className="secondary-button sc-secondary" onClick={() => saveGear("weapon")} type="button">Сохранить оружие</button>
            </div>
            <div className="field">
              <label>Master-броня</label>
              <input value={gearForm.armor} onChange={(event) => setGearForm({ ...gearForm, armor: event.target.value })} placeholder="Например: Сатурн / Танк / Центурион" />
              <button className="secondary-button sc-secondary" onClick={() => saveGear("armor")} type="button">Сохранить броню</button>
            </div>
          </div>
          <div className="sc-gear-grid">
            {equipmentRows.length > 0 ? equipmentRows.map((item) => (
              <article className="activity-card" key={item.id || `${item.slot}-${item.item_name}`}>
                <div className="activity-card-head">
                  <span className="badge success">{item.slot}</span>
                  <span className="activity-time">{item.source || "manual"}</span>
                </div>
                <strong>{item.item_name}</strong>
                <p>{item.item_rank || "master"} · {item.item_category || item.slot}</p>
              </article>
            )) : <p className="panel-note">Снаряжение пока не указано.</p>}
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
