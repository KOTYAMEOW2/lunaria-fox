import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth/session";
import { getClanDashboardForUser } from "@/lib/stalcraft/sc-dashboard";

export const dynamic = "force-dynamic";

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

  return (
    <section className="page-shell">
      <div className="container">
        <div className="page-head">
          <span className="eyebrow">Private Clan Table</span>
          <h1>{data.clan?.clan_name || "STALCRAFT клан"}</h1>
          <p>Закрытая таблица клана: посещения, отсутствия, активность игроков и последние SC-логи.</p>
        </div>

        <section className="panel">
          <div className="dashboard-head">
            <div>
              <span className="eyebrow">Attendance</span>
              <h2>Посещаемость игроков</h2>
            </div>
            <span className="badge muted">{data.stats.length} member(s)</span>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Игрок</th>
                <th>Ранг</th>
                <th>Посещения</th>
                <th>Пропуски</th>
                <th>Ответов всего</th>
                <th>Последний ответ</th>
              </tr>
            </thead>
            <tbody>
              {data.stats.length > 0 ? data.stats.map((row: any) => (
                <tr key={`${row.clan_id}-${row.discord_user_id}`}>
                  <td>{row.character_name || row.discord_user_id}</td>
                  <td>{row.rank || "—"}</td>
                  <td>{row.attended_count || 0}</td>
                  <td>{row.absent_count || 0}</td>
                  <td>{row.answered_count || 0}</td>
                  <td>{row.last_response_at || "—"}</td>
                </tr>
              )) : (
                <tr><td colSpan={6}>Пока нет данных посещаемости.</td></tr>
              )}
            </tbody>
          </table>
        </section>

        <section className="panel" style={{ marginTop: 18 }}>
          <div className="dashboard-head">
            <div>
              <span className="eyebrow">Clan Logs</span>
              <h2>Последние события клана</h2>
            </div>
          </div>
          <div className="activity-feed-grid">
            {data.logs.map((log: any) => (
              <article className="activity-card" key={log.id}>
                <div className="activity-card-head">
                  <span className="badge muted">{log.event_type}</span>
                  <span className="activity-time">{log.created_at}</span>
                </div>
                <strong>{log.title || log.event_type}</strong>
                <p>{log.message || "—"}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
