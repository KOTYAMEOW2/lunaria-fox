-- Lunaria Fox STALCRAFT-only reset
-- Run this in Supabase SQL Editor only after exporting/backuping old data.
-- This intentionally removes the old general-purpose bot schema and creates the new SC schema.

create extension if not exists "pgcrypto";

drop table if exists
  dashboard_sync_states,
  command_permissions,
  command_groups,
  custom_commands,
  commands_registry,
  guild_configs,
  guild_roles,
  guild_channels,
  guild_rules,
  guild_log_settings,
  guild_log_entries,
  bot_analytics,
  smartfilter_configs,
  server_customizations,
  server_panels,
  ticket_configs,
  ticket_panels,
  tickets,
  ticket_messages,
  voicemaster_configs,
  voicemaster_rooms,
  guild_premium_settings,
  brand_roles,
  premium_entitlements,
  stalcraft_profiles,
  stalcraft_characters_cache,
  stalcraft_guild_settings,
  stalcraft_videos,
  bot_guilds
cascade;

create table if not exists sc_guilds (
  guild_id text primary key,
  name text,
  icon text,
  owner_id text,
  member_count integer default 0,
  preferred_locale text default 'ru',
  is_available boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists sc_discord_channels (
  guild_id text references sc_guilds(guild_id) on delete cascade,
  channel_id text,
  name text,
  type text,
  position integer default 0,
  updated_at timestamptz default now(),
  primary key (guild_id, channel_id)
);

create table if not exists sc_discord_roles (
  guild_id text references sc_guilds(guild_id) on delete cascade,
  role_id text,
  name text,
  color text,
  position integer default 0,
  managed boolean default false,
  updated_at timestamptz default now(),
  primary key (guild_id, role_id)
);

create table if not exists sc_guild_settings (
  guild_id text primary key references sc_guilds(guild_id) on delete cascade,
  enabled boolean default true,
  commands_enabled boolean default true,
  video_enabled boolean default false,
  auto_sync_roles boolean default true,
  community_name text,
  clan_id text,
  clan_name text,
  required_clan_id text,
  required_clan_name text,
  region text check (region is null or region in ('RU', 'EU', 'NA', 'SEA')),
  cw_post_hour_msk integer not null default 14,
  cw_start_hour_msk integer not null default 20,
  timezone text not null default 'Europe/Moscow',
  cw_post_channel_id text,
  absence_channel_id text,
  results_channel_id text,
  emission_channel_id text,
  logs_channel_id text,
  sc_commands_channel_id text,
  auto_create_roles boolean default true,
  verified_role_id text,
  verified_role_name text default 'SC Verified',
  role_auto_create boolean default true,
  updated_by text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists sc_roles (
  guild_id text references sc_guilds(guild_id) on delete cascade,
  role_key text check (role_key in ('verified', 'cw_participant', 'leader', 'colonel', 'officer')),
  role_id text,
  role_name text,
  auto_created boolean default false,
  updated_at timestamptz default now(),
  primary key (guild_id, role_key)
);

create table if not exists sc_players (
  discord_user_id text primary key,
  exbo_id text,
  exbo_uuid text,
  exbo_login text,
  exbo_display_login text,
  access_token text,
  refresh_token text,
  token_type text,
  token_expires_at timestamptz,
  selected_region text check (selected_region is null or selected_region in ('RU', 'EU', 'NA', 'SEA')),
  selected_character_id text,
  selected_character_name text,
  selected_clan_id text,
  selected_clan_name text,
  selected_clan_rank text,
  profile_public boolean default true,
  raw_profile jsonb default '{}'::jsonb,
  linked_at timestamptz default now(),
  synced_at timestamptz,
  updated_at timestamptz default now()
);

create table if not exists sc_character_cache (
  discord_user_id text references sc_players(discord_user_id) on delete cascade,
  region text not null check (region in ('RU', 'EU', 'NA', 'SEA')),
  character_id text not null,
  character_name text not null,
  character_created_at timestamptz,
  clan_id text,
  clan_name text,
  clan_level integer,
  clan_alliance text,
  clan_leader text,
  clan_rank text,
  clan_joined_at timestamptz,
  raw jsonb default '{}'::jsonb,
  updated_at timestamptz default now(),
  primary key (discord_user_id, region, character_id)
);

create table if not exists sc_clans (
  clan_id text primary key,
  clan_name text not null,
  region text check (region is null or region in ('RU', 'EU', 'NA', 'SEA')),
  owner_guild_id text references sc_guilds(guild_id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists sc_clan_members (
  clan_id text references sc_clans(clan_id) on delete cascade,
  discord_user_id text references sc_players(discord_user_id) on delete cascade,
  guild_id text references sc_guilds(guild_id) on delete set null,
  character_id text,
  character_name text,
  rank text,
  is_active boolean default true,
  joined_at timestamptz,
  updated_at timestamptz default now(),
  primary key (clan_id, discord_user_id)
);

create table if not exists sc_equipment (
  id uuid primary key default gen_random_uuid(),
  discord_user_id text references sc_players(discord_user_id) on delete cascade,
  character_id text,
  slot text not null,
  item_id text not null,
  item_name text not null,
  item_rank text,
  item_category text,
  source text default 'api',
  verified_by text,
  verified_at timestamptz,
  raw jsonb default '{}'::jsonb,
  updated_at timestamptz default now(),
  unique (discord_user_id, character_id, slot, item_id)
);

create table if not exists sc_profile_showcases (
  discord_user_id text primary key references sc_players(discord_user_id) on delete cascade,
  title text,
  bio text,
  accent_color text default '#9b7cff',
  banner_url text,
  card_style text default 'moon',
  pinned_weapon text,
  pinned_armor text,
  updated_at timestamptz default now()
);

create table if not exists sc_cw_sessions (
  id uuid primary key default gen_random_uuid(),
  guild_id text references sc_guilds(guild_id) on delete cascade,
  clan_id text references sc_clans(clan_id) on delete set null,
  cw_date date not null,
  mode text default 'planned',
  starts_at timestamptz,
  status text default 'scheduled',
  attendance_post_channel_id text,
  attendance_post_message_id text,
  posted_at timestamptz,
  reminder_sent_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (guild_id, cw_date)
);

create table if not exists sc_cw_attendance (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sc_cw_sessions(id) on delete cascade,
  guild_id text references sc_guilds(guild_id) on delete cascade,
  clan_id text references sc_clans(clan_id) on delete set null,
  discord_user_id text references sc_players(discord_user_id) on delete set null,
  character_name text,
  status text not null check (status in ('attending', 'absent', 'unanswered')),
  absence_type text,
  absence_reason text,
  participation_role_applied boolean default false,
  responded_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (session_id, discord_user_id)
);

create table if not exists sc_cw_result_queue (
  id uuid primary key default gen_random_uuid(),
  guild_id text references sc_guilds(guild_id) on delete cascade,
  clan_id text references sc_clans(clan_id) on delete set null,
  session_id uuid references sc_cw_sessions(id) on delete set null,
  discord_user_id text references sc_players(discord_user_id) on delete set null,
  character_name text not null,
  matches_count integer default 1,
  kills integer default 0,
  deaths integer default 0,
  assists integer default 0,
  treasury_spent integer default 0,
  score integer default 0,
  raw jsonb default '{}'::jsonb,
  uploaded_by text,
  created_at timestamptz default now()
);

create table if not exists sc_cw_result_audit (
  id uuid primary key default gen_random_uuid(),
  guild_id text references sc_guilds(guild_id) on delete cascade,
  clan_id text references sc_clans(clan_id) on delete set null,
  session_id uuid references sc_cw_sessions(id) on delete set null,
  sent_by text,
  rows_count integer default 0,
  total_score integer default 0,
  sent_at timestamptz default now()
);

create table if not exists sc_emission_state (
  guild_id text primary key references sc_guilds(guild_id) on delete cascade,
  state text not null default 'idle' check (state in ('idle', 'active')),
  started_at timestamptz,
  ended_at timestamptz,
  last_seen_at timestamptz,
  source text,
  raw jsonb default '{}'::jsonb,
  updated_at timestamptz default now()
);

create table if not exists sc_logs (
  id uuid primary key default gen_random_uuid(),
  guild_id text references sc_guilds(guild_id) on delete cascade,
  clan_id text references sc_clans(clan_id) on delete set null,
  actor_discord_id text,
  target_discord_id text,
  event_type text not null,
  title text,
  message text,
  meta jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists sc_videos (
  id uuid primary key default gen_random_uuid(),
  guild_id text references sc_guilds(guild_id) on delete set null,
  clan_id text references sc_clans(clan_id) on delete set null,
  discord_user_id text references sc_players(discord_user_id) on delete cascade,
  author_name text,
  character_id text,
  character_name text,
  region text,
  title text not null,
  description text,
  video_url text,
  storage_path text,
  thumbnail_url text,
  status text default 'published',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists sc_logs_guild_created_idx on sc_logs(guild_id, created_at desc);
create index if not exists sc_cw_attendance_guild_idx on sc_cw_attendance(guild_id, status);
create index if not exists sc_cw_result_queue_guild_idx on sc_cw_result_queue(guild_id, created_at desc);
create index if not exists sc_players_clan_idx on sc_players(selected_clan_id);
create index if not exists sc_clan_members_discord_idx on sc_clan_members(discord_user_id);

create or replace view sc_clan_attendance_stats as
select
  cm.clan_id,
  cm.discord_user_id,
  cm.character_name,
  cm.rank,
  count(a.id) filter (where a.status = 'attending') as attended_count,
  count(a.id) filter (where a.status = 'absent') as absent_count,
  count(a.id) as answered_count,
  max(a.responded_at) as last_response_at
from sc_clan_members cm
left join sc_cw_attendance a
  on a.clan_id = cm.clan_id
 and a.discord_user_id = cm.discord_user_id
where cm.is_active = true
group by cm.clan_id, cm.discord_user_id, cm.character_name, cm.rank;
