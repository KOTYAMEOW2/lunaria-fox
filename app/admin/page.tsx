import Link from "next/link";
import { redirect } from "next/navigation";

import { assertOwnerSession } from "@/lib/auth/owners";
import { getSession } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getSession();
  if (!session) redirect("/api/auth/discord/login?next=/admin");
  try {
    assertOwnerSession(session);
  } catch {
    redirect("/dashboard");
  }

  const supabase = getSupabaseAdmin();
  const { data: guilds } = supabase
    ? await supabase.from("sc_guilds").select("guild_id, name, member_count, is_available, updated_at").order("name")
    : { data: [] };

  return (
    <section className="page-shell">
      <div className="container">
        <div className="page-head">
          <span className="eyebrow">STALCRAFT Admin</span>
          <h1>Глобальный список SC-серверов</h1>
          <p>Здесь только STALCRAFT-only индекс серверов. Premium и старые general-модули удалены.</p>
        </div>
        <div className="guild-grid">
          {(guilds || []).map((guild: any) => (
            <article className="guild-card" key={guild.guild_id}>
              <div className="guild-card-header">
                <div>
                  <h3>{guild.name || guild.guild_id}</h3>
                  <p>{guild.member_count || 0} members</p>
                </div>
                <span className={`badge ${guild.is_available === false ? "warn" : "success"}`}>
                  {guild.is_available === false ? "offline" : "available"}
                </span>
              </div>
              <div className="stack-actions" style={{ marginTop: 18 }}>
                <Link className="primary-button" href={`/dashboard/${guild.guild_id}`}>Open</Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
