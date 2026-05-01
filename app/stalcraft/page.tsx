import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getStalcraftProfile, listEnabledStalcraftCommunities, listStalcraftCharacters } from "@/lib/stalcraft/data";
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
  const characters = profile ? await listStalcraftCharacters(session.userId).catch(() => []) : [];

  return (
    <section className="page-shell">
      <div className="container">
        <div className="page-head">
          <span className="eyebrow">STALCRAFT</span>
          <h1>Привязка персонажа STALCRAFT</h1>
          <p>Эта привязка используется ботом для `/sc-profile`, `/sc-sync`, публикации STALCRAFT Video и проверки клана.</p>
          {params.error ? <p className="page-alert">Ошибка: {params.error}</p> : null}
          {params.linked ? <p className="page-alert">EXBO-профиль привязан. Теперь выбери персонажа.</p> : null}
        </div>
        <StalcraftProfileClient profile={profile} characters={characters} />

        <div className="section">
          <div className="dashboard-head">
            <div>
              <span className="eyebrow">STALCRAFT Servers</span>
              <h2>Серверы, где включён STALCRAFT-модуль</h2>
              <p className="muted">После включения через Dashboard бот открывает на сервере `/sc-profile`, `/sc-sync`, `/sc-player` и `/sc-video`.</p>
            </div>
          </div>
          <div className="command-grid">
            {communities.length > 0 ? communities.map((community) => (
              <article className="command-card" key={community.guild_id}>
                <span className="eyebrow">{community.video_enabled ? "Video enabled" : "Video disabled"}</span>
                <h3>{community.community_name || community.guild_name || community.guild_id}</h3>
                <p>
                  {community.required_clan_name
                    ? `Требуемый клан: ${community.required_clan_name}.`
                    : "Клан не ограничен настройками сервера."}
                </p>
                <p className="muted">Verified-роль: {community.verified_role_name || "STALCRAFT Verified"}</p>
              </article>
            )) : (
              <article className="panel">
                <h3>Пока нет включённых STALCRAFT-серверов</h3>
                <p>Владелец сервера или лидер клана может открыть Dashboard сервера и включить STALCRAFT Settings.</p>
              </article>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
