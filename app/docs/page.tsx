import { docsSections } from "@/lib/content";

export default function DocsPage() {
  return (
    <section className="page-shell">
      <div className="container">
        <div className="page-head">
          <span className="eyebrow">Docs</span>
          <h1>Технический контур Lunaria Fox</h1>
          <p>
            Эта версия сайта уже опирается на реальную Supabase-схему из бандла бота. Поэтому документация и интерфейс
            движутся синхронно, а не расходятся со временем.
          </p>
        </div>

        <div className="stack">
          {docsSections.map((section) => (
            <article className="panel" key={section.title}>
              <h2>{section.title}</h2>
              <div className="stack">
                {section.items.map((item) => (
                  <div className="panel-note" key={item}>
                    {item}
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
