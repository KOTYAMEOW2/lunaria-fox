import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth/session";
import { getClanDashboardForUser } from "@/lib/stalcraft/sc-dashboard";
import { CwTableImproved } from "@/components/stalcraft/sc-guild-dashboard-client";

export const dynamic = "force-dynamic";

function formatNumber(value: number | string | null | undefined) {
  return new Intl.NumberFormat("ru-RU").format(Number(value || 0));
}

function formatMsk(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Moscow",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function percent(value: number, total: number) {
  if (!total) return "0%";
  return `${Math.round((value / total) * 100)}%`;
}

function ratioText(numerator: number, denominator: number) {
  if (!denominator) return numerator > 0 ? "∞" : "0.00";
  return (numerator / denominator).toFixed(2);
}

function readAuditRows(audit: any) {
  const rows = Array.isArray(audit?.rows) ? audit.rows : [];
  return rows.slice(0, 20);
}

export default async function ClanDashboardPage({ params }: { params: Promise<{ clanId: string }> }) {
  const session = await getSession();
  const { clanId } = await params;
  if (!session) redirect("/api/auth/discord/login");

  let data;
  try {
    data = await getClanDashboardForUser(session, clanId);
  } catch {
    redirect("/stalcraft");
  }

  const stats = data.stats || [];
  const totalMembers = stats.length;
  const totalAttended = stats.reduce((sum: number, row: any) => sum + Number(row.attended_count || 0), 0);
  const totalAbsent = stats.reduce((sum: number, row: any) => sum + Number(row.absent_count || 0), 0);
  const totalAnswers = stats.reduce((sum: number, row: any) => sum + Number(row.answered_count || 0), 0);
  const equipmentByUser = new Map<string, Set<string>>();
  for (const item of data.equipment || []) {
    const userId = String(item.discord_user_id || "");
    if (!userId) continue;
    const slots = equipmentByUser.get(userId) || new Set<string>();
    slots.add(String(item.slot || ""));
    equipmentByUser.set(userId, slots);
  }
  const readyMembers = stats.filter((row: any) => {
    const slots = equipmentByUser.get(String(row.discord_user_id));
    return slots?.has("weapon") && slots?.has("armor");
  }).length;
  const latestAudit = data.resultAudits?.[0] || null;
  const latestRows = readAuditRows(latestAudit);

  return (
    <section className="page-shell sc-page-shell">
      <div className="container">
        <div className="page-head sc-page-head">
          <span className="eyebrow sc-eyebrow">Private Clan Table</span>
          <h1>{data.clan?.clan_name || "STALCRAFT клан"}</h1>
          <p>Закрытый штаб клана: посещения КВ, готовность игроков, опубликованные табы и история сессий.</p>
        </div>

        <section className="panel sc-dashboard-section">
          <div className="dashboard-head">
            <div>
              <span className="eyebrow sc-eyebrow">Clan Snapshot</span>
              <h2>Сводка состава</h2>
            </div>
            <span className="badge muted">{totalMembers} player(s)</span>
          </div>
          <div className="sc-overview-grid">
            <article className="sc-overview-card">
              <span>Игроки</span>
              <strong>{totalMembers}</strong>
              <p>привязанных участников клана</p>
            </article>
            <article className="sc-overview-card">
              <span>Посещения</span>
              <strong>{formatNumber(totalAttended)}</strong>
              <p>ответов “участвую”</p>
            </article>
            <article className="sc-overview-card">
              <span>Пропуски</span>
              <strong>{formatNumber(totalAbsent)}</strong>
              <p>ответов “отсутствую”</p>
            </article>
            <article className="sc-overview-card">
              <span>Ответы</span>
              <strong>{formatNumber(totalAnswers)}</strong>
              <p>всего отметок за КВ</p>
            </article>
            <article className="sc-overview-card">
              <span>Готовность</span>
              <strong>{readyMembers}/{totalMembers}</strong>
              <p>оружие и броня отмечены</p>
            </article>
            <article className="sc-overview-card">
              <span>Последний таб</span>
              <strong>{latestAudit ? formatMsk(latestAudit.published_at || latestAudit.sent_at) : "—"}</strong>
              <p>{latestAudit ? `${latestAudit.rows_count || 0} игроков · счёт ${formatNumber(latestAudit.total_score)}` : "ещё не публиковали"}</p>
            </article>
          </div>
        </section>

        <section className="panel sc-table-card">
          <div className="dashboard-head">
            <div>
              <span className="eyebrow sc-eyebrow">Attendance</span>
              <h2>Посещаемость игроков</h2>
            </div>
            <span className="badge success">{percent(totalAttended, Math.max(totalAnswers, 1))} участий</span>
          </div>
          <div className="sc-result-table-wrap">
            <table className="sc-result-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Игрок</th>
                  <th>Ранг</th>
                  <th>Посещения</th>
                  <th>Пропуски</th>
                  <th>Ответов</th>
                  <th>Готовность</th>
                  <th>Последний ответ</th>
                </tr>
              </thead>
              <tbody>
                {stats.length > 0 ? stats.map((row: any, index: number) => {
                  const slots = equipmentByUser.get(String(row.discord_user_id));
                  const isReady = slots?.has("weapon") && slots?.has("armor");
                  return (
                    <tr key={`${row.clan_id}-${row.discord_user_id}`}>
                      <td>{index + 1}</td>
                      <td>{row.character_name || row.discord_user_id}</td>
                      <td>{row.rank || "—"}</td>
                      <td>{formatNumber(row.attended_count)}</td>
                      <td>{formatNumber(row.absent_count)}</td>
                      <td>{formatNumber(row.answered_count)}</td>
                      <td>{isReady ? "готов" : "нет данных"}</td>
                      <td>{formatMsk(row.last_response_at)}</td>
                    </tr>
                  );
                }) : (
                  <tr><td colSpan={8}>Пока нет данных посещаемости.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel sc-table-card">
          <div className="dashboard-head">
            <div>
              <span className="eyebrow sc-eyebrow">Last Published CW Table</span>
              <h2>Последние опубликованные итоги</h2>
            </div>
            {latestAudit ? (
              <span className="badge muted">{latestRows.length} row(s) · {formatMsk(latestAudit.published_at || latestAudit.sent_at)}</span>
            ) : (
              <span className="badge muted">0 row(s)</span>
            )}
          </div>
          <CwTableImproved
            rows={latestRows.map((row: any) => ({
              character_name: String(row.character_name || "Игрок"),
              matches_count: Number(row.matches_count || 0),
              kills: Number(row.kills || 0),
              deaths: Number(row.deaths || 0),
              assists: Number(row.assists || 0),
              treasury_spent: Number(row.treasury_spent || 0),
              score: Number(row.score || 0),
            }))}
            emptyMessage="Итоги КВ ещё не публиковались через бота."
            showPublishHint="После загрузки табов в штабном обзоре нажми &ldquo;Опубликовать&rdquo; — итоги появятся здесь."
          />
        </section>

        <section className="panel sc-table-card">
          <div className="dashboard-head">
            <div>
              <span className="eyebrow sc-eyebrow">CW Sessions</span>
              <h2>Последние КВ-сессии</h2>
            </div>
            <span className="badge muted">{data.sessions.length} session(s)</span>
          </div>
          <div className="activity-feed-grid">
            {data.sessions.length > 0 ? data.sessions.map((row: any) => (
              <article className="activity-card" key={row.id}>
                <div className="activity-card-head">
                  <span className="badge success">{row.status || "scheduled"}</span>
                  <span className="activity-time">{row.cw_date}</span>
                </div>
                <strong>{row.event_type || "general"}</strong>
                <p>Старт: {formatMsk(row.starts_at)} · пост: {formatMsk(row.posted_at)}</p>
              </article>
            )) : (
              <article className="panel-note">КВ-сессии появятся после первого поста участия от бота.</article>
            )}
          </div>
        </section>
      </div>
    </section>
  );
}
