import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getStalcraftProfile, listStalcraftCharacters } from "@/lib/stalcraft/data";
import { StalcraftProfileClient } from "@/components/stalcraft/stalcraft-profile-client";

export const dynamic = "force-dynamic";

export default async function StalcraftPage({ searchParams }: { searchParams?: Promise<{ error?: string; linked?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/api/auth/discord/login");

  const params = (await searchParams) || {};
  const profile = await getStalcraftProfile(session.userId).catch(() => null);
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
      </div>
    </section>
  );
}
