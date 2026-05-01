export default function DocsPage() {
  const steps = [
    "В Supabase SQL Editor выполнить `supabase/sql/20260501_stalcraft_fresh_schema.sql`.",
    "Запустить бота, чтобы он заполнил `sc_guilds`, роли и каналы сервера.",
    "На сайте открыть Dashboard сервера и выбрать каналы: КВ-пост, отсутствия, итоги, выбросы, логи, sc-команды.",
    "Игрокам привязать EXBO/STALCRAFT профиль на странице STALCRAFT.",
    "На сервере выполнить `/sc-assist setup`, чтобы проверить каналы, роли и клановые настройки.",
    "Игрокам использовать `/sc-assist overview`, `/sc-profile`, `/sc-sync`, `/sc-friends`, `/sc-game daily`, `/sc-game momentka`, `/sc-game artifact`, `/sc-game dice` и `/sc-game transfer` как ежедневные команды-помощники.",
    "Игрокам на странице STALCRAFT указать master-оружие и броню, если EXBO API не отдаёт инвентарь.",
    "Офицерам перед КВ открыть раздел `Отряды КВ` или использовать `/sc-squad create`, `/sc-squad add`, `/sc-squad publish`.",
    "Офицерам выполнить `/sc-readiness`, чтобы увидеть, кто не заполнил снаряжение перед КВ.",
    "В 14:00 МСК бот сам отправит КВ-пост, а в 19:30 даст readiness-сводку.",
    "Табы КВ добавляются на сайте и публикуются командой `/sc-cw publish-results`.",
  ];

  return (
    <section className="page-shell">
      <div className="container">
        <div className="page-head">
          <span className="eyebrow">STALCRAFT Docs</span>
          <h1>Как запустить STALCRAFT-помощника</h1>
          <p>Краткая памятка для версии, где сайт и бот работают как единый штаб клана.</p>
        </div>
        <article className="panel">
          <div className="stack">
            {steps.map((step, index) => (
              <div className="panel-note" key={step}>
                <strong>{index + 1}.</strong> {step}
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}
