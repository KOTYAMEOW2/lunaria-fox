import { docsSections } from "@/lib/content";

export default function DocsPage() {
  return (
    <section className="page-shell">
      <div className="container">
        <div className="page-head">
          <span className="eyebrow">Docs</span>
          <h1>Помощь и настройка</h1>
          <p>Краткая памятка по входу, настройке модулей и работе с дашбордом Lunaria Fox.</p>
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
