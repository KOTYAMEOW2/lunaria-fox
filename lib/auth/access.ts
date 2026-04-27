import { canManageGuild, fetchDiscordGuilds } from "@/lib/auth/discord";
import { isOwnerSession } from "@/lib/auth/owners";
import type { DiscordSession } from "@/lib/types";

export async function getManageableGuildIds(session: DiscordSession) {
  const guilds = await fetchDiscordGuilds(session.accessToken);
  return new Set(guilds.filter(canManageGuild).map((guild) => guild.id));
}

export async function assertGuildAccess(session: DiscordSession | null, guildId: string) {
  if (!session) {
    throw new Error("Unauthorized");
  }

  if (isOwnerSession(session)) {
    return;
  }

  const manageableGuildIds = await getManageableGuildIds(session);
  if (!manageableGuildIds.has(guildId)) {
    throw new Error("Forbidden");
  }
}
