const commands = [
  ["sc-help", "Объясняет подключение STALCRAFT-only режима."],
  ["sc-assist overview", "Живой обзор сервера: клан, КВ, табы, выброс и следующие действия."],
  ["sc-assist setup", "Проверяет каналы, роли, клан и готовность Dashboard-настроек."],
  ["sc-assist roster", "Показывает привязанный состав STALCRAFT-клана."],
  ["sc-assist links", "Даёт быстрые ссылки на Dashboard, табы КВ и профиль игрока."],
  ["sc-profile", "Показывает профиль игрока, клан, ранг и master-снаряжение."],
  ["sc-sync", "Обновляет привязанный профиль и выдаёт SC Verified роль."],
  ["sc-player", "Ищет игрока STALCRAFT по нику."],
  ["sc-cw status", "Показывает посещаемость текущей КВ."],
  ["sc-cw post", "Вручную отправляет КВ-пост с кнопками участия."],
  ["sc-cw tabs", "Показывает очередь табов КВ."],
  ["sc-cw publish-results", "Отправляет итоги КВ и очищает очередь Supabase."],
  ["sc-squad list/create/add/remove/delete/publish", "Создаёт отряды КВ, распределяет игроков и публикует сводку в Discord. Управление доступно офицеру и выше."],
  ["sc-friends", "Показывает зарегистрированных друзей STALCRAFT, которых удалось сопоставить через EXBO/API."],
  ["sc-readiness", "Проверяет, у кого из клана заполнены master-оружие и броня перед КВ."],
  ["sc-game balance/daily/momentka/coinflip/dice/transfer/top", "Мини-игры: баланс жетонов, ежедневный схрон, моментка Зоны, ставки, кости, передача жетонов и топ сервера."],
  ["sc-emission status/start/end", "Показывает или меняет статус выброса."],
];

export default function CommandsPage() {
  return (
    <section className="page-shell">
      <div className="container">
        <div className="page-head">
          <span className="eyebrow">SC Commands</span>
          <h1>Команды STALCRAFT-помощника</h1>
          <p>
            Команды сфокусированы на задачах игрока и штаба: профиль, состав клана, КВ, отряды, табы,
            друзья, мини-игры, выбросы, проверка настроек и быстрый переход в нужный раздел сайта.
          </p>
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
