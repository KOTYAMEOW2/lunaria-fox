"use client";

import { useState, startTransition } from "react";

type AdminGuild = {
  guild_id: string;
  name: string | null;
  member_count: number | null;
  is_available: boolean | null;
  updated_at: string | null;
  latest_action?: {
    id: string;
    action: string;
    status: string;
    reason: string | null;
    error_message: string | null;
    created_at: string | null;
    processed_at: string | null;
  } | null;
};

export function ScAdminGuildControlClient({ guilds }: { guilds: AdminGuild[] }) {
  const [items, setItems] = useState(guilds);
  const [busyGuildId, setBusyGuildId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  async function requestLeave(guild: AdminGuild) {
    const confirmed = window.confirm(
      `Запросить удаление Lunaria Fox с сервера "${guild.name || guild.guild_id}"?\n\nБот выполнит выход через очередь Supabase.`,
    );
    if (!confirmed) return;

    const reason = window.prompt("Причина удаления для audit log:", "Удаление через админ-панель") || "Удаление через админ-панель";

    setBusyGuildId(guild.guild_id);
    setNotice("Создаю заявку на удаление...");

    const response = await fetch(`/api/admin/guilds/${guild.guild_id}/leave`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    const payload = await response.json().catch(() => ({}));

    startTransition(() => {
      setBusyGuildId(null);
      if (!response.ok) {
        setNotice(payload.error || "Не удалось создать заявку.");
        return;
      }

      setNotice("Заявка создана. Бот обработает её в течение минуты.");
      setItems((current) =>
        current.map((item) =>
          item.guild_id === guild.guild_id
            ? {
                ...item,
                latest_action: {
                  id: payload.action?.id || crypto.randomUUID(),
                  action: "leave_guild",
                  status: "pending",
                  reason,
                  error_message: null,
                  created_at: new Date().toISOString(),
                  processed_at: null,
                },
              }
            : item,
        ),
      );
    });
  }

  return (
    <>
      {notice ? <div className="panel-note sc-admin-notice">{notice}</div> : null}
      <div className="guild-grid sc-guild-grid">
        {items.map((guild) => {
          const action = guild.latest_action;
          const pending = action && ["pending", "processing"].includes(action.status);
          const offline = guild.is_available === false;
          return (
            <article className="guild-card sc-guild-card sc-admin-guild-card" key={guild.guild_id}>
              <div className="guild-card-header">
                <div>
                  <h3>{guild.name || guild.guild_id}</h3>
                  <p>{guild.member_count || 0} members · {guild.guild_id}</p>
                </div>
                <span className={`badge ${offline ? "warn" : "success"}`}>
                  {offline ? "bot removed/offline" : "bot online"}
                </span>
              </div>

              <div className="sc-admin-action-state">
                <span className="eyebrow sc-eyebrow">Latest action</span>
                {action ? (
                  <p>
                    <strong>{action.action}</strong> · {action.status}
                    {action.error_message ? ` · ${action.error_message}` : ""}
                  </p>
                ) : (
                  <p>Заявок на удаление пока нет.</p>
                )}
              </div>

              <div className="stack-actions" style={{ marginTop: 18 }}>
                <a className="primary-button sc-primary" href={`/dashboard/${guild.guild_id}`}>
                  Открыть штаб
                </a>
                <button
                  className="ghost-button sc-danger-button"
                  disabled={Boolean(pending || offline || busyGuildId === guild.guild_id)}
                  onClick={() => requestLeave(guild)}
                  type="button"
                >
                  {pending ? "Заявка уже в очереди" : busyGuildId === guild.guild_id ? "Создаю..." : "Удалить бота"}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
