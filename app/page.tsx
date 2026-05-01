import Link from "next/link";

import { buildDashboardUrl, publicEnv } from "@/lib/public-env";

export default function HomePage() {
  return (
    <>
      <section className="sc-home-hero">
        <div className="container sc-hero-grid">
          <div className="sc-hero-copy">
            <div className="sc-kicker-row">
              <span className="eyebrow sc-eyebrow">STALCRAFT Operations Core</span>
              <span className="sc-live-pill">Moscow time · CW 20:00</span>
            </div>
            <h1>Штаб клана для КВ, табов, выбросов и профилей игроков.</h1>
            <p>
              Lunaria Fox больше не универсальный бот. Это STALCRAFT-панель, которая связывает Discord, Supabase и сайт:
              лидеры настраивают сервер, игроки отмечаются на КВ, бот публикует итоги и ведёт закрытую статистику клана.
            </p>
            <div className="hero-actions sc-action-row">
              <a className="primary-button sc-primary" href={buildDashboardUrl("/dashboard")}>Открыть штаб</a>
              <Link className="secondary-button sc-secondary" href="/stalcraft">Привязать профиль</Link>
              <a className="ghost-button sc-ghost" href={publicEnv.inviteUrl} rel="noreferrer" target="_blank">Добавить бота</a>
            </div>
            <div className="sc-mission-strip">
              <div><strong>14:00</strong><span>пост участия</span></div>
              <div><strong>19:30</strong><span>напоминание</span></div>
              <div><strong>20:00</strong><span>старт КВ</span></div>
              <div><strong>SC-only</strong><span>без старых модулей</span></div>
            </div>
          </div>

          <aside className="sc-command-console">
            <div className="sc-console-top">
              <span>LIVE OPS</span>
              <strong>Клановый контур</strong>
            </div>
            <div className="sc-radar-card">
              <div className="sc-radar">
                <span />
                <i />
                <b />
              </div>
              <div className="sc-console-readout">
                <span>Emission watch</span>
                <strong>канал выбросов готов</strong>
              </div>
            </div>
            <div className="sc-terminal">
              <div><span>01</span> SC роли создаются ботом и меняются лидерами</div>
              <div><span>02</span> Табы попадают в очередь Supabase</div>
              <div><span>03</span> После публикации очередь очищается</div>
              <div><span>04</span> Клановая таблица закрыта для чужих</div>
            </div>
          </aside>
        </div>
      </section>

      <section className="section sc-ops-section">
        <div className="container">
          <div className="section-head sc-section-head">
            <div>
              <span className="eyebrow sc-eyebrow">Mission modules</span>
              <h2>Функции, которые реально нужны STALCRAFT-клану</h2>
            </div>
            <Link className="ghost-button sc-ghost" href="/docs">Как запустить</Link>
          </div>
          <div className="sc-ops-grid">
            {[
              ["КВ посещения", "Участвую/Отсутствую, причина отсутствия, отдельный канал отчётов и роль участия."],
              ["Табы и итоги", "Kills, deaths, assists, казна и счёт уходят в итоговый embed, затем удаляются из очереди."],
              ["Выбросы", "Оповещения о начале и конце выброса в настроенный канал без лишних сообщений."],
              ["Профили игроков", "Персонаж, клан, ранг, master-снаряжение и оформление профиля на сайте."],
              ["SC логи", "Только события STALCRAFT: привязки, КВ, табы, выбросы, настройки."],
              ["Клановая таблица", "Закрытая статистика посещений и результатов для конкретного клана."],
            ].map(([title, body], index) => (
              <article className="sc-intel-card" key={title}>
                <span className="sc-card-index">{String(index + 1).padStart(2, "0")}</span>
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section sc-flow-section">
        <div className="container sc-flow-grid">
          <article className="sc-clan-preview">
            <span className="eyebrow sc-eyebrow">Clan table</span>
            <h2>Приватная статистика клана</h2>
            <p>
              После привязки STALCRAFT игрок видит только данные своего клана. Лидеры получают контроль по посещениям,
              отсутствиям и результатам КВ.
            </p>
            <div className="sc-table-preview">
              <div><strong>Игрок</strong><strong>КВ</strong><strong>K/D/A</strong></div>
              <div><span>FoxScout</span><span>17/20</span><span>82/31/44</span></div>
              <div><span>MoonMedic</span><span>19/20</span><span>34/22/91</span></div>
              <div><span>NightTank</span><span>15/20</span><span>46/40/18</span></div>
            </div>
          </article>

          <article className="sc-route-panel">
            <span className="eyebrow sc-eyebrow">Discord flow</span>
            <h2>Как сайт влияет на бота</h2>
            <div className="sc-route-list">
              {[
                ["Dashboard", "лидер выбирает каналы, роли, клан и режимы"],
                ["Supabase", "настройки сохраняются в таблицах sc_*"],
                ["Bot", "бот читает эти настройки и меняет поведение на сервере"],
                ["Discord", "посты, embed-логи, КВ и выбросы уходят в нужные каналы"],
              ].map(([title, body]) => (
                <div className="sc-route-step" key={title}>
                  <strong>{title}</strong>
                  <span>{body}</span>
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>

      <section className="section sc-quick-section">
        <div className="container sc-quick-panel">
          <div>
            <span className="eyebrow sc-eyebrow">Ready for Vercel</span>
            <h2>Сайт собирается как Next.js проект под Vercel.</h2>
            <p>
              В новой версии удалены старые панели, premium-настройки и generic dashboard. В репозиторий нужно заливать
              содержимое новой папки сайта целиком, чтобы старые файлы не остались в GitHub.
            </p>
          </div>
          <a className="primary-button sc-primary" href={buildDashboardUrl("/dashboard")}>Перейти в Dashboard</a>
        </div>
      </section>

    </>
  );
}
