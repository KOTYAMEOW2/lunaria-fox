import { pricingTiers } from "@/lib/content";

export default function PricingPage() {
  return (
    <section className="page-shell">
      <div className="container">
        <div className="page-head">
          <span className="eyebrow">Pricing</span>
          <h1>Premium-слой уже предусмотрен в архитектуре</h1>
          <p>
            В текущем бандле premium подтверждён минимум для VoiceMaster. Сайт уже подготовлен так, чтобы вынести это в
            отдельный billing-слой без перелома всей структуры проекта.
          </p>
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
