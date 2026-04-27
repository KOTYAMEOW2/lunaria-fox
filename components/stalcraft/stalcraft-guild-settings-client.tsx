"use client";

import { useState } from "react";
import type { StalcraftGuildSettingsRow } from "@/lib/stalcraft/types";

type Props = {
  guildId: string;
  initial: StalcraftGuildSettingsRow | null;
};

export function StalcraftGuildSettingsClient({ guildId, initial }: Props) {
  const [state, setState] = useState({
    enabled: initial?.enabled ?? false,
    commandsEnabled: initial?.commands_enabled ?? true,
    videoEnabled: initial?.video_enabled ?? true,
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

  return (
    <div className="dashboard-section">
      <div className="dashboard-head">
        <div>
          <span className="eyebrow">STALCRAFT Community</span>
          <h2>Настройки STALCRAFT-сервера</h2>
          <p className="muted">Когда модуль включён, бот откроет SC-команды и сможет выдавать роль verified.</p>
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
        <button className={`admin-feature-button ${state.commandsEnabled ? "admin-feature-button-active" : ""}`} onClick={() => patch({ commandsEnabled: !state.commandsEnabled })} type="button">
          <strong>SC-команды</strong>
          <span>Можно оставить сервер в STALCRAFT-режиме, но временно скрыть команды.</span>
        </button>
      </div>

      <div className="form-grid" style={{ marginTop: 18 }}>
        <div className="field"><label>Название комьюнити</label><input value={state.communityName} onChange={(e) => patch({ communityName: e.target.value })} placeholder="Например: Lunaria STALCRAFT" /></div>
        <div className="field"><label>Название verified-роли</label><input value={state.verifiedRoleName} onChange={(e) => patch({ verifiedRoleName: e.target.value })} /></div>
        <div className="field"><label>Role ID, если роль уже создана</label><input value={state.verifiedRoleId} onChange={(e) => patch({ verifiedRoleId: e.target.value })} placeholder="Можно оставить пустым" /></div>
        <div className="field"><label>Required Clan ID</label><input value={state.requiredClanId} onChange={(e) => patch({ requiredClanId: e.target.value })} placeholder="Опционально" /></div>
        <div className="field"><label>Required Clan Name</label><input value={state.requiredClanName} onChange={(e) => patch({ requiredClanName: e.target.value })} placeholder="Опционально" /></div>
      </div>

      <div className="stack-actions" style={{ marginTop: 18 }}>
        <button className="primary-button" onClick={save} type="button">Save STALCRAFT Settings</button>
        <a className="ghost-button" href="/stalcraft-video">Open STALCRAFT Video</a>
      </div>
      {status ? <p className="page-alert">{status}</p> : null}
    </div>
  );
}
