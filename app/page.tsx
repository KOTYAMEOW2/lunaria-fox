import Link from "next/link";

import { featureCards, roadmapCards } from "@/lib/content";
import { buildDashboardUrl, publicEnv } from "@/lib/public-env";
import { getPublicCommandDirectory } from "@/lib/data/dashboard-read";

export default async function HomePage() {
  const commands = await getPublicCommandDirectory();
  const spotlight = commands.slice(0, 6);

  return (
    <>
      <section className="hero">
        <div className="container hero-panel">
          <div className="hero-copy">
            <span className="eyebrow">Lunaria Fox Platform</span>
            <h1>Лендинг, дашборд и control plane для Lunaria Fox.</h1>
            <p>
              Lunaria Fox получает не декоративный сайт, а полноценную веб-платформу: брендовый фронт, Discord OAuth,
              серверный dashboard, контроль конфигов через Supabase и связку, в которой бот реально применяет изменения
              из панели.
            </p>
            <div className="hero-actions">
              <a className="primary-button" href={buildDashboardUrl("/dashboard")}>
                Open Dashboard
              </a>
              <a className="secondary-button" href={publicEnv.inviteUrl} rel="noreferrer" target="_blank">
                Invite Lunaria Fox
              </a>
              <Link className="ghost-button" href="/commands">
                Explore Commands
              </Link>
            </div>

            <div className="hero-stats">
              <div className="stat-card">
                <strong>Supabase</strong>
                <span>единая модель данных между ботом, dashboard и premium-слоем</span>
              </div>
              <div className="stat-card">
                <strong>Live Sync</strong>
                <span>dashboard ставит sync-state, бот видит revision и применяет изменения</span>
              </div>
              <div className="stat-card">
                <strong>Vercel</strong>
                <span>нативный runtime для Next.js, OAuth и dashboard</span>
              </div>
            </div>
          </div>

          <div className="hero-aside">
            <div className="fox-orbit">
              <div className="fox-lines" />
            </div>
            <div className="panel">
              <span className="eyebrow">Control Plane</span>
              <h3>Сайт не витрина, а реальная точка управления</h3>
              <p>
                Контур построен по реальным модулям Lunaria Fox: moderation, tickets, VoiceMaster, server panel,
                premium branding, brand role, smart filter и command registry. Сохранение в панели теперь сопровождается
                отдельным sync-state, чтобы видеть применение ботом.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-head">
            <div>
              <span className="eyebrow">Feature Map</span>
              <h2>Публичный сайт и серверный дашборд в одном контуре</h2>
            </div>
          </div>
          <div className="grid-3">
            {featureCards.map((card) => (
              <article className="feature-card" key={card.title}>
                <span className="eyebrow">{card.eyebrow}</span>
                <h3>{card.title}</h3>
                <p>{card.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-head">
            <div>
              <span className="eyebrow">Command Spotlight</span>
              <h2>Живая витрина команд из `commands_registry`</h2>
            </div>
            <Link className="ghost-button" href="/commands">
              Full Directory
            </Link>
          </div>
          <div className="command-grid">
            {spotlight.length > 0 ? (
              spotlight.map((command) => (
                <article className="command-card" key={command.command_name}>
                  <span className="eyebrow">{command.category || "general"}</span>
                  <h3>/{command.command_name}</h3>
                  <p>{command.description || "Описание ещё не синхронизировано из бота."}</p>
                </article>
              ))
            ) : (
              <article className="panel">
                <h3>Команды пока не синхронизированы</h3>
                <p>
                  Как только бот обновит `commands_registry` в Supabase, публичный каталог автоматически наполнится без
                  ручной правки фронта.
                </p>
              </article>
            )}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container grid-2">
          <div className="panel">
            <span className="eyebrow">Build Direction</span>
            <h3>Что уже заложено в архитектуру</h3>
            <div className="stack">
              {roadmapCards.map((item) => (
                <div className="panel-note" key={item}>
                  {item}
                </div>
              ))}
            </div>
          </div>
          <div className="panel">
            <span className="eyebrow">Brand Tone</span>
            <h3>Lunaria Fox</h3>
            <p>
              Визуально платформа держится на лунно-фиолетовой гамме, мягком холодном свечении и более хищном, чем у
              типовых Discord-dashboard шаблонов, характере.
            </p>
            <div className="stack-actions" style={{ marginTop: 18 }}>
              <Link className="primary-button" href="/pricing">
                View Pricing
              </Link>
              <Link className="secondary-button" href="/docs">
                Read Docs
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
