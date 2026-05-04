import Link from "next/link";

import { buildDashboardUrl, publicEnv } from "@/lib/public-env";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getClanRating } from "@/lib/stalcraft/rating";

export const dynamic = "force-dynamic";

type EmissionEvent = {
  id: string;
  event_type: string | null;
  title: string | null;
  message: string | null;
  meta: Record<string, unknown> | null;
  created_at: string | null;
};

async function getHomepageData() {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { emissions: [], guildCount: 0 };

  const [{ data: emissions }, { count: guildCount }] = await Promise.all([
    supabase
      .from("sc_logs")
      .select("id, event_type, title, message, meta, created_at")
      .in("event_type", ["emission_active", "emission_idle", "emission_start", "emission_end"])
      .order("created_at", { ascending: false })
      .limit(4),
    supabase.from("sc_guilds").select("*", { count: "exact", head: true }),
  ]);

  return { emissions: (emissions || []) as EmissionEvent[], guildCount: guildCount || 0 };
}

function nextCwTime() {
  const msk = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Europe/Moscow" }),
  );
  const today = new Date(msk);
  today.setHours(20, 0, 0, 0);
  if (today <= msk) today.setDate(today.getDate() + 1);
  const diffMs = today.getTime() - msk.getTime();
  const h = Math.floor(diffMs / 3_600_000);
  const m = Math.floor((diffMs % 3_600_000) / 60_000);
  return { text: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`, target: today };
}

function formatMsk(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Moscow",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function emissionState(type: string | null) {
  if (type === "emission_active" || type === "emission_start") return { label: "АКТИВЕН", cls: "emission-active" };
  if (type === "emission_end") return { label: "ЗАВЕРШЁН", cls: "emission-end" };
  return { label: "НЕИЗВЕСТНО", cls: "emission-idle" };
}

function timeUntil(target: Date) {
  const diff = target.getTime() - Date.now();
  if (diff <= 0) return "СЕЙЧАС";
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  if (h > 0) return `${h}ч ${m}м`;
  return `${m}м`;
}

export default async function HomePage() {
  const { emissions, guildCount } = await getHomepageData();
  const cwCountdown = nextCwTime();
  const rating = await getClanRating().catch(() => null);
  const top3 = rating?.rows.slice(0, 3) || [];

  const latestEmission = emissions[0];
  const emState = emissionState(latestEmission?.event_type || null);

  return (
    <>
      {/* ─── Hero ─────────────────────────────────────────────── */}
      <section className="sc-hero-zone">
        <div className="container">
          <div className="sc-hero-inner">
            <div className="sc-hero-left">
              <div className="sc-kicker">
                <span className="sc-kicker-tag">STALCRAFT:X</span>
                <span className="sc-kicker-sep" />
                <span className="sc-kicker-region">RU · EU · NA · SEA</span>
              </div>
              <h1 className="sc-hero-title">Штабной бот для&nbsp;кланов STALCRAFT:X</h1>
              <p className="sc-hero-desc">
                Собирай отметки на КВ, веди табы, управляй отрядами и следи за выбросами — всё в Discord и на сайте. Без лишних модулей, без танцев с бубном.
              </p>
              <div className="sc-hero-actions">
                <a className="sc-btn sc-btn-primary" href={publicEnv.inviteUrl} rel="noreferrer" target="_blank">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
                  Добавить бота
                </a>
                <Link className="sc-btn sc-btn-secondary" href="/stalcraft">Привязать профиль</Link>
                <Link className="sc-btn sc-btn-ghost" href={buildDashboardUrl("/dashboard")}>Dashboard</Link>
              </div>
            </div>

            <div className="sc-hero-right">
              <div className="sc-status-card">
                <div className="sc-status-card-head">
                  <span className="sc-status-label">КВ</span>
                  <span className={`sc-status-badge ${latestEmission ? "live" : "idle"}`}>{emState.label}</span>
                </div>
                <div className="sc-countdown">
                  <div className="sc-countdown-label">До КВ 20:00 МСК</div>
                  <div className="sc-countdown-value">{cwCountdown.text}</div>
                </div>
                <div className="sc-countdown-sub">{timeUntil(cwCountdown.target)}</div>
                <div className="sc-emission-row">
                  <div className="sc-emission-item">
                    <span className="sc-emission-label">Последний выброс</span>
                    <span className="sc-emission-time">{latestEmission ? formatMsk(latestEmission.created_at) : "—"} МСК</span>
                  </div>
                  <div className="sc-emission-item">
                    <span className="sc-emission-label">Ботов на серверах</span>
                    <span className="sc-emission-time">{guildCount} серверов</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Top Clans ────────────────────────────────────────── */}
      {top3.length > 0 ? (
        <section className="sc-top-clans">
          <div className="container">
            <div className="sc-section-header">
              <div>
                <span className="eyebrow">Рейтинг</span>
                <h2>Лучшие кланы</h2>
              </div>
              <Link className="sc-btn sc-btn-ghost" href="/clans">Весь рейтинг →</Link>
            </div>
            <div className="sc-top-clans-grid">
              {top3.map((clan, i) => (
                <div key={clan.clanId} className={`sc-top-clan-card rank-${i + 1}`}>
                  <div className="sc-top-clan-rank">#{clan.rank}</div>
                  <div className="sc-top-clan-info">
                    <strong>{clan.tag ? `[${clan.tag}] ` : ""}{clan.name}</strong>
                    <span>{clan.region} · {clan.memberCount} чел.</span>
                  </div>
                  <div className="sc-top-clan-score">{clan.score.toLocaleString("ru-RU")}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* ─── Features ─────────────────────────────────────────── */}
      <section className="sc-features">
        <div className="container">
          <div className="sc-section-header">
            <div>
              <span className="eyebrow">Возможности</span>
              <h2>Что умеет бот</h2>
            </div>
            <Link className="sc-btn sc-btn-ghost" href="/commands">Все команды →</Link>
          </div>
          <div className="sc-features-grid">
            {[
              {
                icon: "⚔",
                title: "Посещаемость КВ",
                desc: "Пост с кнопками «Участвую» и «Отсутствую» в Discord. Причины отсутствий пишутся в отдельный канал. Роль участника КВ выдаётся автоматически.",
              },
              {
                icon: "📊",
                title: "Итоги табов",
                desc: "OCR скриншота КВ → Kills, Deaths, Assists, казна и счёт. Результат публикуется в Discord embed и сохраняется в базу.",
              },
              {
                icon: "🗺",
                title: "Выбросы",
                desc: "Бот отслеживает начало и конец выбросов через API и пишет в канал. Игроки не пропускают опасные окна.",
              },
              {
                icon: "👤",
                title: "Профили игроков",
                desc: "Привязка EXBO/STALCRAFT персонажа. Бот проверяет клан, ранг, выдаёт роли и связывает участие на КВ с реальным персонажем.",
              },
              {
                icon: "🎯",
                title: "Отряды КВ",
                desc: "Офицеры создают отряды и распределяют игроков перед турниром. OG-картинка таблицы отрядов генерируется автоматически.",
              },
              {
                icon: "🏰",
                title: "SC Assistant",
                desc: "Команда /sc-assist показывает обзор сервера: КВ сегодня, очередь табов, выбросы, быстрые ссылки на сайт.",
              },
            ].map((f) => (
              <div className="sc-feature-card" key={f.title}>
                <div className="sc-feature-icon">{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Workflow ────────────────────────────────────────── */}
      <section className="sc-workflow">
        <div className="container">
          <div className="sc-section-header">
            <div>
              <span className="eyebrow">Как работает</span>
              <h2>Цикл подготовки к КВ</h2>
            </div>
          </div>
          <div className="sc-workflow-steps">
            {[
              { step: "01", time: "14:00 МСК", title: "Пост участия", desc: "Бот публикует embed с кнопками «Участвую» и «Отсутствую». У офицеров есть время собрать отряд." },
              { step: "02", time: "до 19:30", title: "Сбор отметок", desc: "Игроки отмечаются. Причины отсутствий уходят в отдельный канал для офицеров." },
              { step: "03", time: "19:30 МСК", title: "Напоминание", desc: "Бот упоминает неответивших в канале. Офицеры видят кто не готов." },
              { step: "04", time: "20:00 МСК", title: "КВ начинается", desc: "Табы КВ загружаются через OCR. Итоговый embed с K/D, казной и счётом публикуется ботом." },
            ].map((s) => (
              <div className="sc-workflow-step" key={s.step}>
                <div className="sc-step-number">{s.step}</div>
                <div className="sc-step-time">{s.time}</div>
                <div className="sc-step-content">
                  <strong>{s.title}</strong>
                  <span>{s.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ──────────────────────────────────────────────── */}
      <section className="sc-cta">
        <div className="container">
          <div className="sc-cta-inner">
            <div>
              <h2>Готов к КВ?</h2>
              <p>Добавь Lunaria Fox на свой Discord-сервер и настрой клан за 5 минут.</p>
            </div>
            <div className="sc-cta-actions">
              <a className="sc-btn sc-btn-primary" href={publicEnv.inviteUrl} rel="noreferrer" target="_blank">
                Добавить бота →
              </a>
              <Link className="sc-btn sc-btn-secondary" href="/commands">Команды</Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
