import { GuildDashboardView } from "../_view";

export default async function GuildAttendancePage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  return <GuildDashboardView guildId={guildId} section="attendance" />;
}
