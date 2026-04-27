"use client";

import { useState } from "react";
import type { GuildRoleRow } from "@/lib/types";
import type { StalcraftGuildSettingsRow } from "@/lib/stalcraft/types";

type Props = {
  guildId: string;
  initial: StalcraftGuildSettingsRow | null;
  roles: GuildRoleRow[];
  selectedClan: {
    clanId: string | null;
    clanName: string | null;
    characterName: string | null;
  } | null;
};

const AUTO_ROLE_VALUE = "__auto__";

export function StalcraftGuildSettingsClient({ guildId, initial, roles, selectedClan }: Props) {
  const selectableRoles = roles.filter((role) => role.role_id !== guildId);
  const [state, setState] = useState({
    enabled: initial?.enabled ?? false,
    commandsEnabled: initial?.commands_enabled ?? true,
    videoEnabled: initial?.video_enabled ?? true,
    autoSyncRoles: initial?.auto_sync_roles ?? true,
    communityName: initial?.community_name || "",
    requiredClanId: initial?.required_clan_id || "",
    requiredClanName: initial?.required_clan_name || "",
    verifiedRoleId: initial?.verified_role_id || "",
    verifiedRoleName: initial?.verified_role_name || "STALCRAFT Verified",
    roleAutoCreate: initial?.role_auto_create ?? true,
  });
  const [status, setStatus] = useState("");

  function patch(next: Partial<typeof state>) {
    setState((current) => ({ ...current, ...next }));
  }

  async function save() {
    setStatus("Сохраняю настройки...");
    const response = await fetch(`/api/dashboard/${guildId}/stalcraft`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        enabled: state.enabled,
        commandsEnabled: state.commandsEnabled,
        videoEnabled: state.videoEnabled,
        autoSyncRoles: state.autoSyncRoles,
        communityName: state.communityName.trim() || null,
        requiredClanId: state.requiredClanId.trim() || null,
        requiredClanName: state.requiredClanName.trim() || null,
        verifiedRoleId: state.verifiedRoleId.trim() || null,
        verifiedRoleName: state.verifiedRoleName.trim() || "STALCRAFT Verified",
        roleAutoCreate: state.roleAutoCreate,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    setStatus(response.ok ? "Настройки сохранены. Бот применит их через dashboard sync." : payload.error || "Ошибка сохранения.");
  }

  function useSelectedClan() {
    if (!selectedClan?.clanId && !selectedClan?.clanName) return;
    patch({
      communityName: selectedClan.clanName || selectedClan.characterName || state.communityName,
      requiredClanId: selectedClan.clanId || state.requiredClanId,
      requiredClanName: selectedClan.clanName || state.requiredClanName,
    });
  }

  return (
    <div className="dashboard-section">
      <div className="dashboard-head">
        <div>
          <span className="eyebrow">STALCRAFT Community</span>
          <h2>Настройки STALCRAFT-сервера</h2>
          <p className="muted">
            Пока сервер не включён здесь, на Discord-сервере видна только `/sc-help`. После сохранения бот заберёт
            настройки из Supabase и откроет SC-команды.
          </p>
        </div>
        <span className={`badge ${state.enabled ? "success" : "warn"}`}>{state.enabled ? "Enabled" : "Disabled"}</span>
      </div>

      <div className="checkbox-grid" style={{ marginTop: 18 }}>
        <button className={`admin-feature-button ${state.enabled ? "admin-feature-button-active" : ""}`} onClick={() => patch({ enabled: !state.enabled })} type="button">
          <strong>Сервер принадлежит STALCRAFT</strong>
          <span>После включения `/sc-profile`, `/sc-sync`, `/sc-player`, `/sc-video` появятся на сервере.</span>
        </button>
        <button className={`admin-feature-button ${state.videoEnabled ? "admin-feature-button-active" : ""}`} onClick={() => patch({ videoEnabled: !state.videoEnabled })} type="button">
          <strong>STALCRAFT Video</strong>
          <span>Авторизованные SC-пользователи смогут публиковать видео через бота.</span>
        </button>
        <button className={`admin-feature-button ${state.roleAutoCreate ? "admin-feature-button-active" : ""}`} onClick={() => patch({ roleAutoCreate: !state.roleAutoCreate })} type="button">
          <strong>Авто-создание роли</strong>
          <span>Бот сам создаст роль, если role ID не указан.</span>
        </button>
        <button className={`admin-feature-button ${state.autoSyncRoles ? "admin-feature-button-active" : ""}`} onClick={() => patch({ autoSyncRoles: !state.autoSyncRoles })} type="button">
          <strong>Авто-выдача роли</strong>
          <span>Бот выдаёт verified-роль при входе участника и через `/sc-sync`.</span>
        </button>
        <button className={`admin-feature-button ${state.commandsEnabled ? "admin-feature-button-active" : ""}`} onClick={() => patch({ commandsEnabled: !state.commandsEnabled })} type="button">
          <strong>SC-команды</strong>
          <span>Можно оставить сервер в STALCRAFT-режиме, но временно скрыть команды.</span>
        </button>
      </div>

      <div className="form-grid" style={{ marginTop: 18 }}>
        <div className="field"><label>Название комьюнити</label><input value={state.communityName} onChange={(e) => patch({ communityName: e.target.value })} placeholder="Например: Lunaria STALCRAFT" /></div>
        <div className="field"><label>Название verified-роли</label><input value={state.verifiedRoleName} onChange={(e) => patch({ verifiedRoleName: e.target.value })} /></div>
        <div className="field">
          <label>Verified-роль</label>
          <select
            value={state.verifiedRoleId || AUTO_ROLE_VALUE}
            onChange={(event) => patch({ verifiedRoleId: event.target.value === AUTO_ROLE_VALUE ? "" : event.target.value })}
          >
            <option value={AUTO_ROLE_VALUE}>Бот создаст или найдёт роль по названию</option>
            {selectableRoles.map((role) => (
              <option disabled={role.managed === true} key={role.role_id} value={role.role_id}>
                {role.name}{role.managed ? " · managed" : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="field"><label>Required Clan ID</label><input value={state.requiredClanId} onChange={(e) => patch({ requiredClanId: e.target.value })} placeholder="Опционально" /></div>
        <div className="field"><label>Required Clan Name</label><input value={state.requiredClanName} onChange={(e) => patch({ requiredClanName: e.target.value })} placeholder="Опционально" /></div>
      </div>

      {selectedClan?.clanName || selectedClan?.characterName ? (
        <div className="page-alert">
          Твой выбранный персонаж: <strong>{selectedClan.characterName || "STALCRAFT"}</strong>
          {selectedClan.clanName ? ` · клан ${selectedClan.clanName}` : ""}.{" "}
          <button className="inline-action" onClick={useSelectedClan} type="button">Подставить мой клан</button>
        </div>
      ) : (
        <p className="page-alert">Перед включением STALCRAFT-сервера привяжи EXBO-профиль и выбери персонажа на странице STALCRAFT.</p>
      )}

      <div className="stack-actions" style={{ marginTop: 18 }}>
        <button className="primary-button" onClick={save} type="button">Save STALCRAFT Settings</button>
        <a className="ghost-button" href="/stalcraft-video">Open STALCRAFT Video</a>
      </div>
      {status ? <p className="page-alert">{status}</p> : null}
    </div>
  );
}
