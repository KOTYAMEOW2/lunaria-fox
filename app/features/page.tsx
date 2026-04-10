import Link from "next/link";

import { featureCards } from "@/lib/content";
import { buildDashboardUrl } from "@/lib/public-env";

const moduleCards = [
  "Overview и базовые guild settings",
  "Command registry, permissions и custom commands",
  "Moderation stack: smart filter, rules, logs",
  "Tickets: config, panels, open ticket activity",
  "VoiceMaster: hubs, templates, room policy",
  "Branding: embeds, webhooks, banner, server panel",
];

export default function FeaturesPage() {
  return (
    <section className="page-shell">
      <div className="container">
        <div className="page-head">
          <span className="eyebrow">Features</span>
          <h1>Что именно получает Lunaria Fox</h1>
          <p>
            Не один landing page, а полноценный сайт с дашбордом, который повторяет направление JuniperBot, но строится
            под реальный текущий backend Lunaria Fox.
          </p>
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

        <div className="section">
          <div className="panel">
            <span className="eyebrow">Dashboard Surface</span>
            <h2>Рабочие секции дашборда</h2>
            <div className="grid-2">
              {moduleCards.map((item) => (
                <div className="panel-note" key={item}>
                  {item}
                </div>
              ))}
            </div>
            <div className="stack-actions" style={{ marginTop: 18 }}>
              <a className="primary-button" href={buildDashboardUrl("/dashboard")}>
                Open Dashboard
              </a>
              <Link className="secondary-button" href="/commands">
                Browse Commands
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
