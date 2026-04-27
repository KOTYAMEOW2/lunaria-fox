"use client";

import { useState, startTransition } from "react";
import type { StalcraftCharacterCacheRow, StalcraftProfileRow } from "@/lib/stalcraft/types";

type Props = {
  profile: StalcraftProfileRow | null;
  characters: StalcraftCharacterCacheRow[];
};

export function StalcraftProfileClient({ profile, characters }: Props) {
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState(profile?.selected_character_id || "");

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
    </div>
  );
}
