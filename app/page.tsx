import Link from "next/link";

import { buildDashboardUrl, publicEnv } from "@/lib/public-env";

export default function HomePage() {
  return (
    <>
      <section className="hero">
        <div className="container hero-panel">
          <div className="hero-copy">
            <span className="eyebrow">STALCRAFT Clan Operations</span>
            <h1>Lunaria Fox теперь работает под КВ, кланы и STALCRAFT-профили.</h1>
            <p>
              Ежедневные отметки на КВ, закрытая таблица клана, итоги табов, выбросы, снаряжение игроков и SC-логи
              в одном Discord-боте и сайте.
            </p>
            <div className="hero-actions">
              <a className="primary-button" href={buildDashboardUrl("/dashboard")}>Open STALCRAFT Dashboard</a>
              <Link className="secondary-button" href="/stalcraft">Link STALCRAFT Profile</Link>
              <a className="ghost-button" href={publicEnv.inviteUrl} rel="noreferrer" target="_blank">Invite Bot</a>
            </div>
            <div className="hero-stats">
              <div className="stat-card"><strong>14:00 МСК</strong><span>ежедневный пост участия на КВ</span></div>
              <div className="stat-card"><strong>20:00 МСК</strong><span>старт КВ и readiness-контроль</span></div>
              <div className="stat-card"><strong>SC-only</strong><span>никаких лишних модулей вне STALCRAFT</span></div>
            </div>
          </div>

          <div className="hero-aside">
            <div className="panel">
              <span className="eyebrow">Discord Embeds</span>
              <h3>Красивые сообщения на сервере</h3>
              <p>
                КВ-посты, отсутствия, итоги, выбросы и логи отправляются в выбранные каналы аккуратными embed-блоками.
              </p>
            </div>
            <div className="panel">
              <span className="eyebrow">Private Clan Table</span>
              <h3>Доступ только своему клану</h3>
              <p>
                Игроки видят таблицу своего клана после привязки EXBO/STALCRAFT, а лидеры управляют настройками сервера.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container grid-3">
          {[
            ["КВ посещения", "Кнопки Участвую/Отсутствую, причина отсутствия и роль участия."],
            ["Табы и итоги", "Kills, deaths, assists, казна и счёт уходят в канал итогов, затем очередь очищается."],
            ["Выбросы", "Оповещения о начале и конце выброса в отдельный канал."],
            ["Профили игроков", "Персонаж, клан, ранг, master-снаряжение и оформление профиля на сайте."],
            ["SC логи", "Только события STALCRAFT: привязки, КВ, табы, выбросы, настройки."],
            ["Клановая таблица", "Закрытая статистика посещений по каждому клану."],
          ].map(([title, body]) => (
            <article className="feature-card" key={title}>
              <span className="eyebrow">STALCRAFT</span>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
