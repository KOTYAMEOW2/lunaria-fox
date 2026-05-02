import { redirect } from "next/navigation";

import { assertGuildAccess } from "@/lib/auth/access";
import { getSession } from "@/lib/auth/session";
import { getScGuildDashboardData } from "@/lib/stalcraft/sc-dashboard";
import { ScAiTabsClient } from "@/components/stalcraft/sc-ai-tabs-client";

export default async function GuildAiTabsPage({ params }: { params: Promise<{ guildId: string }> }) {
  const session = await getSession();
  if (!session) redirect("/api/auth/discord/login");

  const { guildId } = await params;
  try {
    await assertGuildAccess(session, guildId);
  } catch {
    redirect("/dashboard");
  }

  const data = await getScGuildDashboardData(guildId);
  const knownNames = (data.clanMembers || [])
    .map((member: any) => String(member.character_name || "").trim())
    .filter(Boolean);

  return (
    <section className="page-shell sc-page-shell">
      <div className="container">
        <div className="page-head sc-page-head">
          <span className="eyebrow sc-eyebrow">STALCRAFT AI Tabs</span>
          <h1>{data.guild?.name || `Server ${guildId}`}</h1>
          <p>ИИ-проверка скринов таблиц КВ вместо слабого OCR. После проверки строки сохраняются в обычную очередь табов.</p>
        </div>

        <ScAiTabsClient guildId={guildId} knownNames={knownNames} />
      </div>
    </section>
  );
}
