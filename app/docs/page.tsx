export default function DocsPage() {
  const steps = [
    "В Supabase SQL Editor выполнить `supabase/sql/20260430_stalcraft_only_reset.sql`.",
    "Запустить бота, чтобы он заполнил `sc_guilds`, роли и каналы сервера.",
    "На сайте открыть Dashboard сервера и выбрать каналы: КВ-пост, отсутствия, итоги, выбросы, логи, sc-команды.",
    "Игрокам привязать EXBO/STALCRAFT профиль на странице STALCRAFT.",
    "В 14:00 МСК бот сам отправит КВ-пост, а в 19:30 даст readiness-сводку.",
    "Табы КВ добавляются на сайте и публикуются командой `/sc-cw publish-results`.",
  ];

  return (
    <section className="page-shell">
      <div className="container">
        <div className="page-head">
          <span className="eyebrow">STALCRAFT Docs</span>
          <h1>Как запустить новую систему</h1>
          <p>Краткая памятка для STALCRAFT-only версии Lunaria Fox.</p>
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
