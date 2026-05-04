import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import {
  getStalcraftProfile,
  getStalcraftProfileShowcase,
  listEnabledStalcraftCommunities,
  listRegisteredStalcraftFriends,
  listStalcraftCharacters,
  listStalcraftEquipment,
} from "@/lib/stalcraft/data";
import { StalcraftProfileClient } from "@/components/stalcraft/stalcraft-profile-client";

export const dynamic = "force-dynamic";

export default async function StalcraftPage({ searchParams }: { searchParams?: Promise<{ error?: string; linked?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/api/auth/discord/login");

  const params = (await searchParams) || {};
  const [profile, communities] = await Promise.all([
    getStalcraftProfile(session.userId).catch(() => null),
    listEnabledStalcraftCommunities().catch(() => []),
  ]);
  const [characters, friends, equipment, showcase] = profile
    ? await Promise.all([
        listStalcraftCharacters(session.userId).catch(() => []),
        listRegisteredStalcraftFriends(session.userId).catch(() => []),
        listStalcraftEquipment(session.userId).catch(() => []),
        getStalcraftProfileShowcase(session.userId).catch(() => null),
      ])
    : [[], [], [], null];

  return (
    <section className="page-shell">
      <div className="container">
        <div className="page-head">
          <span className="eyebrow">STALCRAFT</span>
          <h1>Привязка персонажа STALCRAFT</h1>
          <p>Эта привязка используется ботом для `/sc-profile`, `/sc-sync`, проверки клана, ролей и КВ-статистики.</p>
          {params.error ? <p className="page-alert">Ошибка: {params.error}</p> : null}
          {params.linked ? <p className="page-alert">EXBO-профиль привязан. Теперь выбери персонажа.</p> : null}
        </div>
        <StalcraftProfileClient profile={profile} characters={characters} equipment={equipment} friends={friends} showcase={showcase} />

        <div className="section">
          <div className="dashboard-head">
            <div>
              <span className="eyebrow">SC Assistant</span>
              <h2>Что делать после привязки</h2>
              <p className="muted">Эти команды используют твой выбранный STALCRAFT-персонаж и настройки клана.</p>
            </div>
          </div>
          <div className="grid-3">
            {[
              ["`/sc-sync`", "Обновляет персонажа, клан, ранг, master-снаряжение и выдаёт SC Verified роль, если клан подходит."],
              ["`/sc-profile`", "Показывает твой профиль внутри Discord: персонаж, регион, клан, ранг и найденное снаряжение."],
              ["`/sc-assist overview`", "Показывает состояние сервера: КВ сегодня, очередь табов, выбросы и быстрые ссылки на сайт."],
            ].map(([title, body]) => (
              <article className="feature-card" key={title}>
                <span className="eyebrow">PLAYER FLOW</span>
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="section">
          <div className="dashboard-head">
            <div>
              <span className="eyebrow">STALCRAFT Clans</span>
              <h2>Серверы, где выбран STALCRAFT-клан</h2>
              <p className="muted">Здесь отображаются только серверы, где в Dashboard выбран клан. Обычные серверы бота без клановой настройки сюда не попадают.</p>
            </div>
          </div>
          <div className="command-grid">
            {communities.length > 0 ? communities.map((community) => (
              <article className="command-card" key={community.guild_id}>
                <span className="eyebrow">CLAN LINKED</span>
                <h3>{community.community_name || community.guild_name || community.guild_id}</h3>
                <p>
                  {community.required_clan_name
                    ? `Клан: ${community.required_clan_name}.`
                    : "Клан выбран, но имя пока не синхронизировано."}
                </p>
                <p className="muted">Verified-роль: {community.verified_role_name || "STALCRAFT Verified"}</p>
              </article>
            )) : (
              <article className="panel">
                <h3>Пока нет серверов с выбранным кланом</h3>
                <p>Лидер клана открывает Dashboard сервера, привязывает персонажа и выбирает клан в настройках STALCRAFT.</p>
              </article>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
