"use client";

import Link from "next/link";
import { startTransition, useMemo, useState } from "react";

import type { AdminManagedGuild } from "@/lib/types";

type Props = {
  guilds: AdminManagedGuild[];
};

type AdminGuildState = AdminManagedGuild & {
  saving: boolean;
  saveMessage: string | null;
  saveError: string | null;
};

const premiumFeatureOptions = [
  { key: "branding", label: "Premium Branding" },
  { key: "brand-role", label: "Brand Role" },
  { key: "analytics", label: "Analytics Pro" },
  { key: "server-panel", label: "Server Panel Customization" },
  { key: "welcome", label: "Welcome / Leave Branding" },
] as const;

function createGuildState(guild: AdminManagedGuild): AdminGuildState {
  return {
    ...guild,
    premiumFeatures: Array.isArray(guild.premiumFeatures) ? [...guild.premiumFeatures] : [],
    saving: false,
    saveMessage: null,
    saveError: null,
  };
}

function statusBadge(status: string | null) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "applied") return "success";
  if (normalized === "error") return "danger";
  if (normalized === "processing" || normalized === "queued") return "warn";
  return "";
}

export function AdminPremiumControlPlane({ guilds: initialGuilds }: Props) {
  const [query, setQuery] = useState("");
  const [guilds, setGuilds] = useState<AdminGuildState[]>(() => initialGuilds.map(createGuildState));

  const filteredGuilds = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return guilds;
    return guilds.filter((guild) =>
      `${guild.name} ${guild.id} ${guild.ownerId || ""}`.toLowerCase().includes(needle),
    );
  }, [guilds, query]);

  function patchGuild(guildId: string, patch: Partial<AdminGuildState>) {
    setGuilds((current) =>
      current.map((guild) => (guild.id === guildId ? { ...guild, ...patch } : guild)),
    );
  }

  function toggleFeature(guildId: string, featureKey: string) {
    setGuilds((current) =>
      current.map((guild) => {
        if (guild.id !== guildId) return guild;
        const hasFeature = guild.premiumFeatures.includes(featureKey);
        return {
          ...guild,
          premiumFeatures: hasFeature
            ? guild.premiumFeatures.filter((item) => item !== featureKey)
            : [...guild.premiumFeatures, featureKey],
          saveMessage: null,
          saveError: null,
        };
      }),
    );
  }

  async function saveGuild(guildId: string) {
    const snapshot = guilds.find((guild) => guild.id === guildId);
    if (!snapshot || snapshot.saving) return;

    patchGuild(guildId, { saving: true, saveMessage: null, saveError: null });

    try {
      const response = await fetch(`/api/admin/guilds/${guildId}/premium`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          premiumActive: snapshot.premiumActive,
          planName: snapshot.premiumPlan || "premium",
          features: snapshot.premiumFeatures,
        }),
      });

      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
        syncState?: {
          revision?: number | null;
          bot_applied_revision?: number | null;
          status?: string | null;
          last_error?: string | null;
          bot_seen_at?: string | null;
          bot_applied_at?: string | null;
        } | null;
      };

      if (!response.ok) {
        throw new Error(body.error || "Не удалось сохранить premium-настройки.");
      }

      startTransition(() => {
        patchGuild(guildId, {
          saving: false,
          saveMessage: "Premium-настройки сохранены.",
          saveError: null,
          syncRevision: Number(body.syncState?.revision || snapshot.syncRevision),
          appliedRevision: Number(body.syncState?.bot_applied_revision || snapshot.appliedRevision),
          syncStatus: body.syncState?.status || snapshot.syncStatus,
          syncError: body.syncState?.last_error || null,
          botSeenAt: body.syncState?.bot_seen_at || snapshot.botSeenAt,
          botAppliedAt: body.syncState?.bot_applied_at || snapshot.botAppliedAt,
        });
      });
    } catch (error) {
      patchGuild(guildId, {
        saving: false,
        saveMessage: null,
        saveError: error instanceof Error ? error.message : "Не удалось сохранить premium-настройки.",
      });
    }
  }

  return (
    <div className="stack">
      <div className="panel admin-premium-toolbar">
        <div className="section-head" style={{ marginBottom: 0 }}>
          <div>
            <h2 style={{ fontSize: "1.5rem" }}>Premium Guild Control</h2>
            <p>
              Здесь owner может включать premium, менять план и feature-флаги по всем серверам из индекса бота.
              Детальные premium-настройки по конкретной гильдии остаются в обычном guild dashboard.
            </p>
          </div>
          <div className="field admin-search-field">
            <label htmlFor="admin-guild-search">Поиск сервера</label>
            <input
              id="admin-guild-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Название сервера, guild ID или owner ID"
            />
          </div>
        </div>
      </div>

      <div className="guild-grid">
        {filteredGuilds.map((guild) => (
          <article className="guild-card admin-premium-card" key={guild.id}>
            <div className="guild-card-header">
              <div>
                <h3>{guild.name}</h3>
                <p>
                  Guild ID <code>{guild.id}</code> · owner {guild.ownerId ? <code>{guild.ownerId}</code> : "—"}
                </p>
              </div>
              <div className="stack-actions" style={{ alignItems: "flex-end" }}>
                <span className={`badge ${guild.isAvailable ? "success" : "warn"}`}>
                  {guild.isAvailable ? "Available" : "Unavailable"}
                </span>
                <span className={`badge ${statusBadge(guild.syncStatus)}`}>{guild.syncStatus || "no sync"}</span>
              </div>
            </div>

            <div className="form-grid" style={{ marginTop: 18 }}>
              <div className="field">
                <label htmlFor={`premium-plan-${guild.id}`}>Premium plan</label>
                <input
                  id={`premium-plan-${guild.id}`}
                  value={guild.premiumPlan || ""}
                  onChange={(event) =>
                    patchGuild(guild.id, {
                      premiumPlan: event.target.value,
                      saveMessage: null,
                      saveError: null,
                    })
                  }
                  placeholder="premium"
                />
              </div>

              <button
                type="button"
                className={`module-toggle-card ${guild.premiumActive ? "module-toggle-card-active" : ""}`}
                onClick={() =>
                  patchGuild(guild.id, {
                    premiumActive: !guild.premiumActive,
                    saveMessage: null,
                    saveError: null,
                  })
                }
              >
                <div className="module-toggle-top">
                  <strong>{guild.premiumActive ? "Premium Enabled" : "Premium Disabled"}</strong>
                  <span className={`module-toggle-state ${guild.premiumActive ? "success" : ""}`}>
                    {guild.premiumActive ? "Active" : "Inactive"}
                  </span>
                </div>
                <p>Owner override для premium-гильдии без ручного редактирования базы.</p>
                <div className={`module-toggle-knob ${guild.premiumActive ? "module-toggle-knob-active" : ""}`}>
                  <span />
                </div>
              </button>
            </div>

            <div className="admin-feature-grid">
              {premiumFeatureOptions.map((feature) => {
                const active = guild.premiumFeatures.includes(feature.key);
                return (
                  <button
                    key={feature.key}
                    type="button"
                    className={`admin-feature-button ${active ? "admin-feature-button-active" : ""}`}
                    onClick={() => toggleFeature(guild.id, feature.key)}
                  >
                    <strong>{feature.label}</strong>
                    <span>{active ? "Enabled" : "Disabled"}</span>
                  </button>
                );
              })}
            </div>

            <div className="admin-save-row">
              <button
                type="button"
                className="primary-button"
                onClick={() => saveGuild(guild.id)}
                disabled={guild.saving}
              >
                {guild.saving ? "Сохранение..." : "Save Premium"}
              </button>
              <Link className="ghost-button" href={`/dashboard/${guild.id}`}>
                Open Guild Dashboard
              </Link>
            </div>

            {guild.saveMessage ? <p className="panel-note">{guild.saveMessage}</p> : null}
            {guild.saveError ? <p className="page-alert">{guild.saveError}</p> : null}
            {guild.syncError ? <p className="page-alert">Sync error: {guild.syncError}</p> : null}

            <div className="admin-meta-grid">
              <div className="control-card">
                <strong>Members</strong>
                <span>{guild.memberCount}</span>
              </div>
              <div className="control-card">
                <strong>Sync</strong>
                <span>
                  {guild.appliedRevision}/{guild.syncRevision}
                </span>
              </div>
              <div className="control-card">
                <strong>Locale</strong>
                <span>{guild.preferredLocale.toUpperCase()}</span>
              </div>
            </div>
          </article>
        ))}
      </div>

      {filteredGuilds.length === 0 ? (
        <p className="page-alert">По этому запросу серверы не найдены.</p>
      ) : null}
    </div>
  );
}
