export type DiscordSession = {
  userId: string;
  username: string;
  globalName: string | null;
  avatar: string | null;
  accessToken: string | null;
  expiresAt: number;
};

export type DiscordGuild = {
  id: string;
  name: string;
  icon: string | null;
  owner?: boolean;
  permissions?: string;
};

export type GuildRoleRow = {
  guild_id: string;
  role_id: string;
  name: string;
  color?: string | null;
  position?: number | null;
  managed?: boolean | null;
};
