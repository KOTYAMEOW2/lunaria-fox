import { GuildDashboardView } from "../_view";

export default async function GuildSquadsPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  return <GuildDashboardView guildId={guildId} section="squads" />;
}
