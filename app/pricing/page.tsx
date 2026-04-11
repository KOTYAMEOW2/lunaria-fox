import { pricingTiers } from "@/lib/content";

export default function PricingPage() {
  return (
    <section className="page-shell">
      <div className="container">
        <div className="page-head">
          <span className="eyebrow">Pricing</span>
          <h1>Планы Lunaria Fox</h1>
          <p>Базовые функции доступны сразу, а premium даёт больше кастомизации и расширенные возможности сервера.</p>
        </div>

        <div className="grid-2">
          {pricingTiers.map((tier) => (
            <article className="panel" key={tier.name}>
              <span className="eyebrow">{tier.name}</span>
              <h2>{tier.price}</h2>
              <p>{tier.lead}</p>
              <div className="stack" style={{ marginTop: 16 }}>
                {tier.bullets.map((bullet) => (
                  <div className="panel-note" key={bullet}>
                    {bullet}
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
