import { redirect } from "next/navigation";

export default async function GuildLogsPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  redirect(`/dashboard/${guildId}/settings`);
}
