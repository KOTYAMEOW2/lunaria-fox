const commands = [
  ["sc-help", "Объясняет подключение STALCRAFT-only режима."],
  ["sc-profile", "Показывает профиль игрока, клан, ранг и master-снаряжение."],
  ["sc-sync", "Обновляет привязанный профиль и выдаёт SC Verified роль."],
  ["sc-player", "Ищет игрока STALCRAFT по нику."],
  ["sc-cw status", "Показывает посещаемость текущей КВ."],
  ["sc-cw post", "Вручную отправляет КВ-пост с кнопками участия."],
  ["sc-cw tabs", "Показывает очередь табов КВ."],
  ["sc-cw publish-results", "Отправляет итоги КВ и очищает очередь Supabase."],
  ["sc-emission status/start/end", "Показывает или меняет статус выброса."],
];

export default function CommandsPage() {
  return (
    <section className="page-shell">
      <div className="container">
        <div className="page-head">
          <span className="eyebrow">SC Commands</span>
          <h1>Команды Lunaria Fox STALCRAFT</h1>
          <p>Старые moderation/tickets/voice/fun команды удалены. Остались только STALCRAFT-команды.</p>
        </div>
        <article className="panel">
          <table className="data-table">
            <thead>
              <tr><th>Команда</th><th>Назначение</th></tr>
            </thead>
            <tbody>
              {commands.map(([name, description]) => (
                <tr key={name}>
                  <td><code>/{name}</code></td>
                  <td>{description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
      </div>
    </section>
  );
}
