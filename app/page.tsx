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
            <h1>Управляй Lunaria Fox с одного дашборда.</h1>
            <p>
              Настраивай команды, модули, модерацию, тикеты, VoiceMaster, брендинг и premium-функции сервера без
              ручной правки конфигов.
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
                <strong>Commands</strong>
                <span>управление slash-командами, custom commands и доступом</span>
              </div>
              <div className="stat-card">
                <strong>Moderation</strong>
                <span>smart filter, правила, журналы и базовые настройки модерации</span>
              </div>
              <div className="stat-card">
                <strong>Premium</strong>
                <span>брендинг, brand role, server panel, welcome и analytics</span>
              </div>
            </div>
          </div>

          <div className="hero-aside">
            <div className="fox-orbit">
              <div className="fox-orbit-caption">
                <span className="eyebrow">Lunaria Visual</span>
                <strong>Moonlit control panel</strong>
              </div>
            </div>
            <div className="panel">
              <span className="eyebrow">Dashboard</span>
              <h3>Все важные настройки сервера в одном месте</h3>
              <p>
                Lunaria Fox даёт отдельные разделы для команд, модерации, тикетов, VoiceMaster, брендинга и
                premium-функций, чтобы управлять сервером без лишней путаницы.
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
              <h2>Всё, что нужно для управления сервером</h2>
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
              <h2>Команды Lunaria Fox</h2>
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
                  <p>{command.description || "Описание скоро появится."}</p>
                </article>
              ))
            ) : (
              <article className="panel">
                <h3>Каталог команд скоро появится</h3>
                <p>После первой публикации команд здесь отобразится полный список возможностей Lunaria Fox.</p>
              </article>
            )}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container grid-2">
          <div className="panel">
            <span className="eyebrow">Dashboard</span>
            <h3>Что доступно в панели</h3>
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
              Ночной визуальный стиль, лунно-фиолетовая палитра и спокойная подача делают панель узнаваемой и не
              похожей на типовой шаблон Discord-бота.
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
