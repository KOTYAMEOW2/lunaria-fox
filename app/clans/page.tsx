import Link from "next/link";

import { getClanRating } from "@/lib/stalcraft/rating";

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
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default async function ClanRatingPage() {
  const rating = await getClanRating();
  const tableRows = rating.rows;
  const topClan = tableRows[0] || null;
  const sourceLabel = rating.source === "official_api" ? "official STALCRAFT API" : "local Supabase cache";

  return (
    <section className="page-shell sc-page-shell">
      <div className="container">
        <div className="page-head sc-page-head clan-rating-hero">
          <span className="eyebrow sc-eyebrow">Clan Rating</span>
          <h1>Актуальный рейтинг STALCRAFT-кланов</h1>
          <p>
            Таблица собирается по регионам RU, EU, NA и SEA. Основной показатель ранжирования — clan level points
            из официального STALCRAFT API; если API недоступен, сайт показывает локальную статистику из Supabase.
          </p>
          <div className="sc-overview-actions">
            <Link className="primary-button sc-primary" href="/stalcraft">Привязать профиль</Link>
            <Link className="secondary-button sc-secondary" href="/dashboard">Открыть Dashboard</Link>
          </div>
        </div>

        {rating.error ? (
          <div className="panel-note sc-panel-warning">
            Официальный рейтинг сейчас недоступен: {rating.error}. Ниже показан fallback из Supabase.
          </div>
        ) : null}

        <section className="sc-rating-summary">
          <article className="sc-overview-card">
            <span>Источник</span>
            <strong>{sourceLabel}</strong>
            <p>обновлено {formatMsk(rating.updatedAt)} МСК</p>
          </article>
          <article className="sc-overview-card">
            <span>Кланов в таблице</span>
            <strong>{formatNumber(rating.rows.length)}</strong>
            <p>отображаются все загруженные строки</p>
          </article>
          <article className="sc-overview-card">
            <span>Регионы</span>
            <strong>{rating.regions.join(" / ") || "—"}</strong>
            <p>общий рейтинг по доступным данным</p>
          </article>
          <article className="sc-overview-card">
            <span>Лидер рейтинга</span>
            <strong>{topClan ? `${topClan.tag ? `[${topClan.tag}] ` : ""}${topClan.name}` : "—"}</strong>
            <p>{topClan ? `${topClan.region} · ${formatNumber(topClan.score)} очков` : "данных пока нет"}</p>
          </article>
        </section>

        <section className="panel sc-table-card sc-rating-table-card">
          <div className="dashboard-head">
            <div>
              <span className="eyebrow sc-eyebrow">Global leaderboard</span>
              <h2>Рейтинг кланов</h2>
            </div>
            <span className="badge muted">{tableRows.length} row(s)</span>
          </div>
          <div className="sc-result-table-wrap">
            <table className="sc-result-table sc-rating-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Клан</th>
                  <th>Регион</th>
                  <th>Уровень</th>
                  <th>Очки уровня</th>
                  <th>Участники</th>
                  <th>Лидер</th>
                  <th>Счёт рейтинга</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.length > 0 ? tableRows.map((row) => (
                  <tr key={`${row.region}-${row.clanId}`}>
                    <td>{row.rank}</td>
                    <td>
                      <strong>{row.tag ? `[${row.tag}] ` : ""}{row.name}</strong>
                      <small>{row.externalClanId || row.clanId}</small>
                    </td>
                    <td>{row.region}</td>
                    <td>{formatNumber(row.level)}</td>
                    <td>{formatNumber(row.levelPoints)}</td>
                    <td>{formatNumber(row.memberCount)}</td>
                    <td>{row.leader || "—"}</td>
                    <td>{formatNumber(row.score)}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={8}>Данных рейтинга пока нет. Проверь `STALCRAFT_APPLICATION_TOKEN` в Vercel.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </section>
  );
}
