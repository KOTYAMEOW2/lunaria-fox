import Link from "next/link";

import { buildDashboardUrl, publicEnv } from "@/lib/public-env";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type EmissionEvent = {
  id: string;
  event_type: string | null;
  title: string | null;
  message: string | null;
  created_at: string | null;
};

async function getRecentEmissionEvents() {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [] as EmissionEvent[];

  const { data, error } = await supabase
    .from("sc_logs")
    .select("id, event_type, title, message, created_at")
    .in("event_type", ["emission_active", "emission_idle", "emission_start", "emission_end"])
    .order("created_at", { ascending: false })
    .limit(4);

  if (error) return [] as EmissionEvent[];
  return (data || []) as EmissionEvent[];
}

function formatEmissionTime(value: string | null) {
  if (!value) return "нет времени";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Moscow",
  }).format(new Date(value));
}

function emissionLabel(eventType: string | null) {
  return eventType === "emission_active" || eventType === "emission_start" ? "Начало" : "Конец";
}

export default async function HomePage() {
  const emissions = await getRecentEmissionEvents();

  return (
    <>
      <section className="sc-home-hero">
        <div className="container sc-hero-grid">
          <div className="sc-hero-copy">
            <div className="sc-kicker-row">
              <span className="eyebrow sc-eyebrow">SC:X clan bot</span>
              <span className="sc-live-pill">CW 20:00 MSK</span>
            </div>
            <h1>Discord-бот для STALCRAFT:X кланов и игроков.</h1>
            <p>
              Lunaria Fox помогает клану держать Discord в порядке: собирает отметки на КВ, ведёт табы,
              публикует итоги, напоминает о событиях и помогает игрокам привязать STALCRAFT-профиль.
              Бот подходит для RU, EU, NA, SEA и других сообществ, где нужен понятный штаб без лишних модулей.
            </p>
            <div className="hero-actions sc-action-row">
              <a className="primary-button sc-primary" href={publicEnv.inviteUrl} rel="noreferrer" target="_blank">
                Добавить бота
              </a>
              <Link className="secondary-button sc-secondary" href="/stalcraft">
                Привязать профиль
              </Link>
              <a className="ghost-button sc-ghost" href={buildDashboardUrl("/dashboard")}>
                Открыть Dashboard
              </a>
            </div>
            <div className="sc-mission-strip">
              <div><strong>14:00</strong><span>бот публикует пост участия</span></div>
              <div><strong>20:00</strong><span>клан видит готовность к КВ</span></div>
              <div><strong>Tabs</strong><span>K/D/A, казна и счёт в итогах</span></div>
              <div><strong>Profile</strong><span>персонаж, клан, роль и снаряжение</span></div>
            </div>
          </div>

          <aside className="sc-command-console">
            <div className="sc-console-top">
              <span>ZONE SIGNALS</span>
              <strong>Журнал выбросов</strong>
            </div>
            <div className="sc-emission-card">
              <p>
                В лоре STALCRAFT/X и S.T.A.L.K.E.R. выброс — опасная волна аномальной энергии Зоны.
                Во время выброса игрокам нужно укрытие, поэтому бот сообщает о начале и завершении события
                в выбранный Discord-канал.
              </p>
              <div className="sc-emission-list">
                {emissions.length > 0 ? emissions.map((event) => (
                  <div className="sc-emission-row" key={event.id}>
                    <span>{emissionLabel(event.event_type)}</span>
                    <strong>{event.title || "Выброс"}</strong>
                    <time>{formatEmissionTime(event.created_at)} МСК</time>
                  </div>
                )) : (
                  <div className="sc-emission-empty">
                    <strong>Истории выбросов пока нет</strong>
                    <span>После первых сообщений бота здесь появятся последние начала и завершения выбросов.</span>
                  </div>
                )}
              </div>
            </div>
            <div className="sc-terminal">
              <div><span>01</span> Игрок нажимает “Участвую” или “Отсутствую” перед КВ</div>
              <div><span>02</span> Офицеры получают причины отсутствий в отдельный канал</div>
              <div><span>03</span> Табы КВ публикуются в красивом Discord embed</div>
              <div><span>04</span> Профиль игрока связывает Discord, клан и STALCRAFT-персонажа</div>
            </div>
          </aside>
        </div>
      </section>

      <section className="section sc-ops-section">
        <div className="container">
          <div className="section-head sc-section-head">
            <div>
              <span className="eyebrow sc-eyebrow">Bot abilities</span>
              <h2>Что получают игроки и штаб клана</h2>
            </div>
            <Link className="ghost-button sc-ghost" href="/commands">Команды</Link>
          </div>
          <div className="sc-ops-grid">
            {[
              ["Отметки на КВ", "Пост с кнопками “Участвую” и “Отсутствую”, сбор причин и роль участника КВ."],
              ["Итоги табов", "Kills, deaths, assists, казна и счёт уходят в итоговый embed Discord."],
              ["Оповещения о выбросах", "Бот пишет начало и конец выброса в выбранный канал, чтобы игроки не пропускали опасные окна."],
              ["Профили игроков", "Игрок привязывает EXBO/STALCRAFT и выбирает персонажа, а бот использует эти данные для ролей и статистики."],
              ["Клановая статистика", "Закрытые страницы для клана: посещаемость, результаты, активность и состав."],
              ["Админ-контроль", "Owner может видеть серверы бота и через админ-панель отправить команду на выход с нежелательного сервера."],
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
            <span className="eyebrow sc-eyebrow">For players</span>
            <h2>Профиль, который работает внутри Discord</h2>
            <p>
              Игрок выбирает своего STALCRAFT-персонажа на сайте, после чего бот может показывать профиль,
              проверять принадлежность к клану, выдавать роли и связывать участие на КВ с реальным персонажем.
            </p>
            <div className="sc-table-preview">
              <div><strong>Игрок</strong><strong>КВ</strong><strong>K/D/A</strong></div>
              <div><span>FoxScout</span><span>17/20</span><span>82/31/44</span></div>
              <div><span>MoonMedic</span><span>19/20</span><span>34/22/91</span></div>
              <div><span>NightTank</span><span>15/20</span><span>46/40/18</span></div>
            </div>
          </article>

          <article className="sc-route-panel">
            <span className="eyebrow sc-eyebrow">For staff</span>
            <h2>Настройки сайта сразу меняют поведение бота</h2>
            <div className="sc-route-list">
              {[
                ["Каналы", "КВ-пост, отсутствия, итоги, выбросы, логи и SC-команды."],
                ["Роли", "Verified, участник КВ, лидер, полковник и офицер выбираются из ролей сервера."],
                ["Клан", "Клан выбирается из доступных персонажей, без ручного поиска Clan ID."],
                ["Discord", "Бот читает Supabase и публикует сообщения только в выбранные каналы."],
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
    </>
  );
}
