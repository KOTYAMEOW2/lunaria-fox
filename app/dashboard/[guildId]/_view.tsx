import { redirect } from "next/navigation";

import { assertGuildAccess } from "@/lib/auth/access";
import { getSession } from "@/lib/auth/session";
import { listStalcraftCharacters } from "@/lib/stalcraft/data";
import { getScGuildDashboardData } from "@/lib/stalcraft/sc-dashboard";
import { ScGuildDashboardClient, type ScDashboardSection } from "@/components/stalcraft/sc-guild-dashboard-client";

const sectionCopy: Record<ScDashboardSection, { eyebrow: string; title: string; description: string }> = {
  settings: {
    eyebrow: "STALCRAFT Settings",
    title: "Настройки сервера",
    description: "Каналы, роли, клан и регион, которые бот использует на этом Discord-сервере.",
  },
  attendance: {
    eyebrow: "CW Attendance",
    title: "Посещения КВ",
    description: "Отметки участников, отсутствия и причины, которые бот собирает через кнопки Discord.",
  },
  tabs: {
    eyebrow: "CW Tabs",
    title: "Табы и итоги КВ",
    description: "Загрузка скринов КВ, проверка OCR и общая таблица K/D по всем загруженным табам.",
  },
};

export async function GuildDashboardView({ guildId, section }: { guildId: string; section: ScDashboardSection }) {
  const session = await getSession();

  if (!session) redirect("/api/auth/discord/login");
  try {
    await assertGuildAccess(session, guildId);
  } catch {
    redirect("/dashboard");
  }

  const [data, userCharacters] = await Promise.all([
    getScGuildDashboardData(guildId),
    listStalcraftCharacters(session.userId).catch(() => []),
  ]);
  (data as any).userCharacters = userCharacters;
  const copy = sectionCopy[section];

  return (
    <section className="page-shell sc-page-shell">
      <div className="container">
        <div className="page-head sc-page-head">
          <span className="eyebrow sc-eyebrow">{copy.eyebrow}</span>
          <h1>{data.guild?.name || `Server ${guildId}`}</h1>
          <p>{copy.description}</p>
        </div>

        <ScGuildDashboardClient activeSection={section} guildId={guildId} data={data} />
      </div>
    </section>
  );
}
