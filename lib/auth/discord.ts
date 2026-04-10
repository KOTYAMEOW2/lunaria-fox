import { env, isDiscordConfigured } from "@/lib/env";
import type { DiscordGuild } from "@/lib/types";

const DISCORD_API_BASE = "https://discord.com/api/v10";
const ADMINISTRATOR = BigInt(8);
const MANAGE_GUILD = BigInt(32);

type DiscordTokenResponse = {
  access_token: string;
  expires_in: number;
};

type DiscordUserResponse = {
  id: string;
  username: string;
  global_name: string | null;
  avatar: string | null;
};

function assertDiscordEnv() {
  if (!isDiscordConfigured()) {
    throw new Error("Discord OAuth environment is not configured.");
  }
}

function buildAvatarUrl(userId: string, avatar: string | null) {
  if (!avatar) return null;
  const ext = avatar.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/avatars/${userId}/${avatar}.${ext}?size=256`;
}

export function buildDiscordAuthorizeUrl(state: string) {
  assertDiscordEnv();

  const url = new URL("https://discord.com/oauth2/authorize");
  url.searchParams.set("client_id", env.discordClientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", env.discordRedirectUri);
  url.searchParams.set("scope", "identify guilds");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeDiscordCode(code: string) {
  assertDiscordEnv();

  const body = new URLSearchParams({
    client_id: env.discordClientId,
    client_secret: env.discordClientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: env.discordRedirectUri,
  });

  const response = await fetch(`${DISCORD_API_BASE}/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Discord token exchange failed.");
  }

  return (await response.json()) as DiscordTokenResponse;
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
