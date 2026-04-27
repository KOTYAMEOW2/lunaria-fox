export type StalcraftRegion = "RU" | "EU" | "NA" | "SEA";

export type ExboUser = {
  id: number | string;
  uuid: string | null;
  login: string | null;
  display_login: string | null;
  distributor?: string | null;
  distributor_id?: string | null;
};

export type StalcraftTokenResponse = {
  token_type: string;
  expires_in: number;
  access_token: string;
  refresh_token?: string;
};

export type StalcraftCharacterApiRow = {
  information?: {
    id?: string;
    name?: string;
    creationTime?: string;
  };
  clan?: {
    info?: {
      id?: string;
      name?: string;
      level?: number;
      registrationTime?: string;
      alliance?: string;
      description?: string;
      leader?: string;
    } | null;
    member?: {
      name?: string;
      rank?: string;
      joinTime?: string;
    } | null;
  } | null;
};

export type StalcraftCharacterCacheRow = {
  discord_user_id: string;
  region: StalcraftRegion;
  character_id: string;
  character_name: string;
  character_created_at: string | null;
  clan_id: string | null;
  clan_name: string | null;
  clan_level: number | null;
  clan_alliance: string | null;
  clan_leader: string | null;
  clan_rank: string | null;
  clan_joined_at: string | null;
  raw: unknown;
  updated_at: string;
};

export type StalcraftProfileRow = {
  discord_user_id: string;
  exbo_id: string;
  exbo_uuid: string | null;
  exbo_login: string | null;
  exbo_display_login: string | null;
  access_token: string | null;
  refresh_token: string | null;
  token_type: string | null;
  token_expires_at: string | null;
  selected_region: StalcraftRegion | null;
  selected_character_id: string | null;
  selected_character_name: string | null;
  selected_clan_id: string | null;
  selected_clan_name: string | null;
  selected_clan_rank: string | null;
  linked_at: string | null;
  updated_at: string | null;
};

export type StalcraftGuildSettingsRow = {
  guild_id: string;
  enabled: boolean | null;
  commands_enabled: boolean | null;
  video_enabled: boolean | null;
  community_name: string | null;
  required_clan_id: string | null;
  required_clan_name: string | null;
  verified_role_id: string | null;
  verified_role_name: string | null;
  role_auto_create: boolean | null;
  updated_at: string | null;
  updated_by: string | null;
};

export type StalcraftVideoRow = {
  id: string;
  guild_id: string | null;
  discord_user_id: string;
  author_name: string | null;
  character_id: string | null;
  character_name: string | null;
  region: StalcraftRegion | null;
  title: string;
  description: string | null;
  video_url: string | null;
  storage_path: string | null;
  thumbnail_url: string | null;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
};
