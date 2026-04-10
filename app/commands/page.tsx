import { getPublicCommandDirectory } from "@/lib/data/dashboard-read";

export default async function CommandsPage() {
  const commands = await getPublicCommandDirectory();
  const groups = Object.entries(
    commands.reduce<Record<string, typeof commands>>((acc, command) => {
      const key = command.category || "other";
      acc[key] ??= [];
      acc[key].push(command);
      return acc;
    }, {}),
  );

  return (
    <section className="page-shell">
      <div className="container">
        <div className="page-head">
          <span className="eyebrow">Commands</span>
          <h1>Публичный каталог команд</h1>
          <p>
            Каталог наполняется из `commands_registry` Supabase. Если бот публикует новые slash/prefix команды, сайт
            может показывать их без ручного обновления контента.
          </p>
        </div>

        {groups.length > 0 ? (
          <div className="stack">
            {groups.map(([category, items]) => (
              <article className="panel" key={category}>
                <span className="eyebrow">{category}</span>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Command</th>
                      <th>Type</th>
                      <th>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((command) => (
                      <tr key={command.command_name}>
                        <td>/{command.command_name}</td>
                        <td>{command.command_type || "both"}</td>
                        <td>{command.description || "Описание отсутствует."}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </article>
            ))}
          </div>
        ) : (
          <article className="panel">
            <h2>Команды пока не синхронизированы</h2>
            <p>
              В текущем состоянии база не вернула публичный реестр команд. После очередного старта бота каталог обновится
              автоматически.
            </p>
          </article>
        )}
      </div>
    </section>
  );
}
