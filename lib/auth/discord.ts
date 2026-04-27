import type { DiscordGuild } from "@/lib/types";

const DISCORD_API_BASE = "https://discord.com/api/v10";
const ADMINISTRATOR = BigInt(8);
const MANAGE_GUILD = BigInt(32);

type DiscordUserResponse = {
  id: string;
  username: string;
  global_name: string | null;
  avatar: string | null;
};

function buildAvatarUrl(userId: string, avatar: string | null) {
  if (!avatar) return null;
  const ext = avatar.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/avatars/${userId}/${avatar}.${ext}?size=256`;
}

export async function fetchDiscordUser(accessToken: string) {
  const response = await fetch(`${DISCORD_API_BASE}/users/@me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Unable to fetch Discord user.");
  }

  const data = (await response.json()) as DiscordUserResponse;

  return {
    id: data.id,
    username: data.username,
    globalName: data.global_name,
    avatar: buildAvatarUrl(data.id, data.avatar),
  };
}

export async function fetchDiscordGuilds(accessToken: string) {
  const response = await fetch(`${DISCORD_API_BASE}/users/@me/guilds`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Unable to fetch Discord guilds.");
  }

  return (await response.json()) as DiscordGuild[];
}

export function canManageGuild(guild: DiscordGuild) {
  if (guild.owner) return true;

  try {
    const bits = BigInt(guild.permissions || "0");
    return (bits & ADMINISTRATOR) === ADMINISTRATOR || (bits & MANAGE_GUILD) === MANAGE_GUILD;
  } catch {
    return false;
  }
}
