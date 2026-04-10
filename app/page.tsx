import Link from "next/link";

import { featureCards, roadmapCards } from "@/lib/content";
import { env } from "@/lib/env";
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
            <h1>Сайт и дашборд для Discord-бота уровня control plane.</h1>
            <p>
              Lunaria Fox получает не просто лендинг, а рабочую веб-платформу: публичный брендовый сайт, Discord OAuth,
              дашборд по серверам, управление конфигами через Supabase и архитектуру под Cloudflare.
            </p>
            <div className="hero-actions">
              <Link className="primary-button" href="/dashboard">
                Open Dashboard
              </Link>
              <a className="secondary-button" href={env.inviteUrl} rel="noreferrer" target="_blank">
                Invite Lunaria Fox
              </a>
              <Link className="ghost-button" href="/commands">
                Explore Commands
              </Link>
            </div>

            <div className="hero-stats">
              <div className="stat-card">
                <strong>Supabase</strong>
                <span>единая модель данных между ботом и сайтом</span>
              </div>
              <div className="stat-card">
                <strong>Discord OAuth</strong>
                <span>авторизация без ручного выбора серверов</span>
              </div>
              <div className="stat-card">
                <strong>Cloudflare</strong>
                <span>SSR и деплой через OpenNext Workers</span>
              </div>
            </div>
          </div>

          <div className="hero-aside">
            <div className="fox-orbit">
              <div className="fox-lines" />
            </div>
            <div className="panel">
              <span className="eyebrow">Reference Matched</span>
              <h3>Опора на реальный бандл бота</h3>
              <p>
                Сайт уже строится по фактическим модулям Lunaria Fox: moderation, tickets, VoiceMaster, server panel,
                command registry, smart filter и branding.
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
