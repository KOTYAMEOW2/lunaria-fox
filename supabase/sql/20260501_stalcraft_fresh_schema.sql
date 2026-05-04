-- Lunaria Fox STALCRAFT-only fresh schema.
-- Use after old tables were removed. This recreates only the new sc_* schema,
-- admin panel tables, indexes, triggers, views, grants and RLS policies.

begin;

create extension if not exists pgcrypto;

drop view if exists public.sc_clan_attendance_stats cascade;

drop function if exists public.current_discord_id() cascade;
drop function if exists public.sc_role_weight(text) cascade;
drop function if exists public.is_sc_owner() cascade;
drop function if exists public.has_clan_access(text, text) cascade;
drop function if exists public.has_guild_access(text, text) cascade;
drop function if exists public.is_stalcraft_linked() cascade;
drop function if exists public.touch_updated_at() cascade;

drop table if exists
  public.sc_admin_audit_logs,
  public.sc_admin_bot_actions,
  public.sc_admin_bot_flags,
  public.sc_admin_guild_notes,
  public.sc_site_owners,
  public.sc_guild_admins,
  public.sc_discord_channels,
  public.sc_discord_roles,
  public.sc_guild_settings,
  public.sc_roles,
  public.sc_cw_squad_members,
  public.sc_cw_squads,
  public.sc_clan_access,
  public.sc_clan_members,
  public.sc_friends,
  public.sc_character_cache,
  public.sc_equipment,
  public.sc_profile_showcases,
  public.sc_cw_attendance,
  public.sc_cw_result_queue,
  public.sc_cw_result_audit,
  public.sc_cw_sessions,
  public.sc_emission_state,
  public.sc_logs,
  public.sc_videos,
  public.sc_game_transactions,
  public.sc_game_balances,
  public.sc_players,
  public.sc_clans,
  public.sc_guilds
cascade;

create table public.sc_site_owners (
  discord_user_id text primary key,
  note text,
  created_at timestamptz not null default now()
);

create table public.sc_guilds (
  guild_id text primary key,
  name text,
  icon text,
  icon_url text,
  owner_id text,
  member_count integer not null default 0,
  preferred_locale text not null default 'ru',
  is_available boolean not null default true,
  bot_joined_at timestamptz not null default now(),
  bot_left_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sc_game_balances (
  guild_id text not null references public.sc_guilds(guild_id) on delete cascade,
  discord_user_id text not null,
  balance bigint not null default 0 check (balance >= 0),
  daily_streak integer not null default 0 check (daily_streak >= 0),
  last_daily_at timestamptz,
  last_moment_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (guild_id, discord_user_id)
);

create table public.sc_game_transactions (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null references public.sc_guilds(guild_id) on delete cascade,
  discord_user_id text not null,
  amount bigint not null,
  reason text not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.sc_guild_admins (
  guild_id text not null references public.sc_guilds(guild_id) on delete cascade,
  discord_user_id text not null,
  access_level text not null default 'admin'
    check (access_level in ('owner', 'admin', 'leader', 'colonel', 'officer', 'member')),
  created_at timestamptz not null default now(),
  primary key (guild_id, discord_user_id)
);

create table public.sc_discord_channels (
  guild_id text not null references public.sc_guilds(guild_id) on delete cascade,
  channel_id text not null,
  name text,
  type text,
  parent_id text,
  position integer not null default 0,
  is_available boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (guild_id, channel_id)
);

create table public.sc_discord_roles (
  guild_id text not null references public.sc_guilds(guild_id) on delete cascade,
  role_id text not null,
  name text,
  color text,
  position integer not null default 0,
  managed boolean not null default false,
  permissions text,
  is_available boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (guild_id, role_id)
);

create table public.sc_clans (
  clan_id text primary key,
  external_clan_id text,
  clan_name text not null,
  name text,
  tag text,
  slug text,
  region text check (region is null or region in ('RU', 'EU', 'NA', 'SEA')),
  owner_guild_id text references public.sc_guilds(guild_id) on delete set null,
  source text not null default 'manual',
  created_by_discord_user_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (region, external_clan_id)
);

create table public.sc_players (
  discord_user_id text primary key,
  auth_user_id uuid,
  exbo_id text,
  exbo_uuid text,
  exbo_login text,
  exbo_display_login text,
  access_token text,
  refresh_token text,
  token_type text default 'Bearer',
  token_expires_at timestamptz,
  selected_region text check (selected_region is null or selected_region in ('RU', 'EU', 'NA', 'SEA')),
  selected_character_id text,
  selected_character_name text,
  selected_clan_id text,
  selected_clan_name text,
  selected_clan_rank text,
  clan_id text references public.sc_clans(clan_id) on delete set null,
  profile_public boolean not null default true,
  raw_profile jsonb not null default '{}'::jsonb,
  linked_at timestamptz default now(),
  synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sc_friends (
  discord_user_id text not null references public.sc_players(discord_user_id) on delete cascade,
  friend_discord_user_id text not null references public.sc_players(discord_user_id) on delete cascade,
  source text not null default 'exbo',
  game_friend_name text,
  matched_by text,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (discord_user_id, friend_discord_user_id),
  check (discord_user_id <> friend_discord_user_id)
);

create table public.sc_guild_settings (
  guild_id text primary key references public.sc_guilds(guild_id) on delete cascade,
  enabled boolean not null default true,
  commands_enabled boolean not null default true,
  auto_sync_roles boolean not null default true,
  community_name text,
  clan_id text references public.sc_clans(clan_id) on delete set null,
  clan_name text,
  required_clan_id text,
  required_clan_name text,
  region text check (region is null or region in ('RU', 'EU', 'NA', 'SEA')),
  cw_post_hour_msk integer not null default 14 check (cw_post_hour_msk between 0 and 23),
  cw_start_hour_msk integer not null default 20 check (cw_start_hour_msk between 0 and 23),
  cw_reminder_hour_msk integer not null default 19 check (cw_reminder_hour_msk between 0 and 23),
  timezone text not null default 'Europe/Moscow',
  cw_post_channel_id text,
  absence_channel_id text,
  results_channel_id text,
  squads_channel_id text,
  emission_channel_id text,
  logs_channel_id text,
  sc_commands_channel_id text,
  auto_create_roles boolean not null default true,
  verified_role_id text,
  verified_role_name text not null default 'SC Verified',
  role_auto_create boolean not null default true,
  emission_tracking_enabled boolean not null default true,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sc_roles (
  guild_id text not null references public.sc_guilds(guild_id) on delete cascade,
  role_key text not null check (role_key in ('verified', 'cw_participant', 'leader', 'colonel', 'officer')),
  role_id text,
  role_name text not null,
  auto_created boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (guild_id, role_key)
);

create table public.sc_character_cache (
  discord_user_id text not null references public.sc_players(discord_user_id) on delete cascade,
  region text not null check (region in ('RU', 'EU', 'NA', 'SEA')),
  character_id text not null,
  character_name text not null,
  character_created_at timestamptz,
  clan_id text references public.sc_clans(clan_id) on delete set null,
  clan_external_id text,
  clan_name text,
  clan_level integer,
  clan_alliance text,
  clan_leader text,
  clan_rank text,
  clan_joined_at timestamptz,
  stats jsonb not null default '{}'::jsonb,
  raw jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (discord_user_id, region, character_id)
);

create table public.sc_clan_members (
  clan_id text not null references public.sc_clans(clan_id) on delete cascade,
  discord_user_id text not null references public.sc_players(discord_user_id) on delete cascade,
  guild_id text references public.sc_guilds(guild_id) on delete set null,
  character_id text,
  character_name text,
  rank text,
  member_role text,
  is_active boolean not null default true,
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (clan_id, discord_user_id)
);

create table public.sc_clan_access (
  clan_id text not null references public.sc_clans(clan_id) on delete cascade,
  discord_user_id text not null,
  access_level text not null default 'member'
    check (access_level in ('leader', 'colonel', 'officer', 'member')),
  granted_by text,
  created_at timestamptz not null default now(),
  primary key (clan_id, discord_user_id)
);

create table public.sc_equipment (
  id uuid primary key default gen_random_uuid(),
  discord_user_id text not null references public.sc_players(discord_user_id) on delete cascade,
  character_id text,
  slot text not null,
  item_id text not null,
  item_name text not null,
  item_rank text,
  item_level text default 'master',
  item_category text,
  source text not null default 'api',
  verified_by text,
  verified_at timestamptz,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (discord_user_id, character_id, slot, item_id)
);

create table public.sc_profile_showcases (
  discord_user_id text primary key references public.sc_players(discord_user_id) on delete cascade,
  title text,
  bio text,
  accent_color text not null default '#88ffc0',
  banner_url text,
  avatar_frame text,
  card_style text not null default 'stalker',
  pinned_weapon text,
  pinned_armor text,
  badges jsonb not null default '[]'::jsonb,
  visibility text not null default 'clan' check (visibility in ('public', 'clan', 'private')),
  updated_at timestamptz not null default now()
);

create table public.sc_cw_sessions (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null references public.sc_guilds(guild_id) on delete cascade,
  clan_id text references public.sc_clans(clan_id) on delete set null,
  cw_date date not null,
  mode text not null default 'planned',
  event_type text not null default 'general'
    check (event_type in ('tournament', 'skirmish', 'general')),
  starts_at timestamptz,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'planned', 'open', 'closed', 'published')),
  attendance_post_channel_id text,
  attendance_post_message_id text,
  posted_at timestamptz,
  reminder_sent_at timestamptz,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (guild_id, cw_date)
);

create table public.sc_cw_squads (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null references public.sc_guilds(guild_id) on delete cascade,
  clan_id text references public.sc_clans(clan_id) on delete set null,
  session_id uuid references public.sc_cw_sessions(id) on delete set null,
  name text not null,
  description text,
  voice_channel_id text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sc_cw_squad_members (
  squad_id uuid not null references public.sc_cw_squads(id) on delete cascade,
  discord_user_id text not null references public.sc_players(discord_user_id) on delete cascade,
  character_name text,
  assigned_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (squad_id, discord_user_id)
);

create table public.sc_cw_attendance (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sc_cw_sessions(id) on delete cascade,
  guild_id text not null references public.sc_guilds(guild_id) on delete cascade,
  clan_id text references public.sc_clans(clan_id) on delete set null,
  discord_user_id text references public.sc_players(discord_user_id) on delete set null,
  character_name text,
  status text not null check (status in ('attending', 'absent', 'unanswered')),
  absence_type text check (absence_type is null or absence_type in ('tournament', 'skirmish', 'both', 'other')),
  absence_reason text,
  participation_role_applied boolean not null default false,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, discord_user_id)
);

create table public.sc_cw_result_queue (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null references public.sc_guilds(guild_id) on delete cascade,
  clan_id text references public.sc_clans(clan_id) on delete set null,
  session_id uuid references public.sc_cw_sessions(id) on delete set null,
  discord_user_id text references public.sc_players(discord_user_id) on delete set null,
  character_name text not null,
  matches_count integer not null default 1,
  kills integer not null default 0,
  deaths integer not null default 0,
  assists integer not null default 0,
  treasury_spent integer not null default 0,
  score integer not null default 0,
  raw jsonb not null default '{}'::jsonb,
  uploaded_by text,
  created_by text,
  created_at timestamptz not null default now()
);

create table public.sc_cw_result_audit (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null references public.sc_guilds(guild_id) on delete cascade,
  clan_id text references public.sc_clans(clan_id) on delete set null,
  session_id uuid references public.sc_cw_sessions(id) on delete set null,
  sent_by text,
  rows_count integer not null default 0,
  total_score integer not null default 0,
  published_channel_id text,
  published_message_id text,
  rows jsonb not null default '[]'::jsonb,
  totals jsonb not null default '{}'::jsonb,
  sent_at timestamptz not null default now(),
  published_at timestamptz not null default now()
);

create table public.sc_emission_state (
  guild_id text primary key references public.sc_guilds(guild_id) on delete cascade,
  state text not null default 'idle' check (state in ('unknown', 'idle', 'active')),
  started_at timestamptz,
  ended_at timestamptz,
  last_started_at timestamptz,
  last_ended_at timestamptz,
  last_seen_at timestamptz,
  source text,
  raw jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.sc_logs (
  id uuid primary key default gen_random_uuid(),
  guild_id text references public.sc_guilds(guild_id) on delete cascade,
  clan_id text references public.sc_clans(clan_id) on delete set null,
  actor_discord_id text,
  target_discord_id text,
  actor_discord_user_id text,
  target_discord_user_id text,
  event_type text not null,
  title text,
  message text,
  meta jsonb not null default '{}'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.sc_admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_discord_user_id text not null,
  action text not null,
  target_type text,
  target_id text,
  before_data jsonb,
  after_data jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.sc_admin_bot_actions (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null references public.sc_guilds(guild_id) on delete cascade,
  action text not null check (action in ('leave_guild', 'send_cw_post')),
  status text not null default 'pending' check (status in ('pending', 'processing', 'done', 'failed', 'cancelled')),
  reason text,
  requested_by text,
  error_message text,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  processed_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.sc_admin_bot_flags (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  description text,
  updated_by text,
  updated_at timestamptz not null default now()
);

create table public.sc_admin_guild_notes (
  guild_id text primary key references public.sc_guilds(guild_id) on delete cascade,
  note text,
  risk_level text not null default 'normal' check (risk_level in ('normal', 'watch', 'blocked')),
  updated_by text,
  updated_at timestamptz not null default now()
);

create index sc_guild_settings_clan_idx on public.sc_guild_settings(clan_id);
create index sc_guild_admins_user_idx on public.sc_guild_admins(discord_user_id);
create index sc_discord_channels_guild_idx on public.sc_discord_channels(guild_id, position);
create index sc_discord_roles_guild_idx on public.sc_discord_roles(guild_id, position desc);
create index sc_game_transactions_user_idx on public.sc_game_transactions(guild_id, discord_user_id, created_at desc);
create index sc_players_auth_idx on public.sc_players(auth_user_id);
create index sc_players_selected_clan_idx on public.sc_players(selected_clan_id);
create index sc_players_clan_idx on public.sc_players(clan_id);
create index sc_friends_friend_idx on public.sc_friends(friend_discord_user_id);
create index sc_character_cache_clan_idx on public.sc_character_cache(clan_id);
create index sc_clan_members_discord_idx on public.sc_clan_members(discord_user_id);
create index sc_cw_sessions_guild_date_idx on public.sc_cw_sessions(guild_id, cw_date desc);
create index sc_cw_squads_guild_idx on public.sc_cw_squads(guild_id, updated_at desc);
create index sc_cw_squads_clan_idx on public.sc_cw_squads(clan_id);
create index sc_cw_squad_members_user_idx on public.sc_cw_squad_members(discord_user_id);
create index sc_cw_attendance_session_idx on public.sc_cw_attendance(session_id, status);
create index sc_cw_attendance_guild_idx on public.sc_cw_attendance(guild_id, status);
create index sc_cw_result_queue_guild_idx on public.sc_cw_result_queue(guild_id, created_at desc);
create index sc_logs_guild_created_idx on public.sc_logs(guild_id, created_at desc);
create index sc_logs_clan_created_idx on public.sc_logs(clan_id, created_at desc);
create index sc_admin_bot_actions_pending_idx on public.sc_admin_bot_actions(status, created_at);
create index sc_admin_bot_actions_guild_idx on public.sc_admin_bot_actions(guild_id, created_at desc);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger sc_guilds_touch before update on public.sc_guilds for each row execute function public.touch_updated_at();
create trigger sc_game_balances_touch before update on public.sc_game_balances for each row execute function public.touch_updated_at();
create trigger sc_clans_touch before update on public.sc_clans for each row execute function public.touch_updated_at();
create trigger sc_guild_settings_touch before update on public.sc_guild_settings for each row execute function public.touch_updated_at();
create trigger sc_roles_touch before update on public.sc_roles for each row execute function public.touch_updated_at();
create trigger sc_players_touch before update on public.sc_players for each row execute function public.touch_updated_at();
create trigger sc_character_cache_touch before update on public.sc_character_cache for each row execute function public.touch_updated_at();
create trigger sc_clan_members_touch before update on public.sc_clan_members for each row execute function public.touch_updated_at();
create trigger sc_equipment_touch before update on public.sc_equipment for each row execute function public.touch_updated_at();
create trigger sc_profile_showcases_touch before update on public.sc_profile_showcases for each row execute function public.touch_updated_at();
create trigger sc_cw_sessions_touch before update on public.sc_cw_sessions for each row execute function public.touch_updated_at();
create trigger sc_cw_squads_touch before update on public.sc_cw_squads for each row execute function public.touch_updated_at();
create trigger sc_cw_squad_members_touch before update on public.sc_cw_squad_members for each row execute function public.touch_updated_at();
create trigger sc_cw_attendance_touch before update on public.sc_cw_attendance for each row execute function public.touch_updated_at();
create trigger sc_emission_state_touch before update on public.sc_emission_state for each row execute function public.touch_updated_at();
create trigger sc_admin_bot_actions_touch before update on public.sc_admin_bot_actions for each row execute function public.touch_updated_at();
create trigger sc_admin_bot_flags_touch before update on public.sc_admin_bot_flags for each row execute function public.touch_updated_at();
create trigger sc_admin_guild_notes_touch before update on public.sc_admin_guild_notes for each row execute function public.touch_updated_at();

create or replace function public.current_discord_id()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(auth.jwt() ->> 'provider_id', ''),
    nullif(auth.jwt() #>> '{user_metadata,provider_id}', ''),
    nullif(auth.jwt() #>> '{user_metadata,discord_id}', ''),
    nullif(auth.jwt() #>> '{user_metadata,sub}', ''),
    nullif(auth.jwt() #>> '{app_metadata,provider_id}', ''),
    nullif(auth.jwt() #>> '{app_metadata,discord_id}', '')
  );
$$;

create or replace function public.sc_role_weight(access_level text)
returns integer
language sql
immutable
as $$
  select case lower(coalesce(access_level, ''))
    when 'owner' then 100
    when 'admin' then 90
    when 'leader' then 80
    when 'colonel' then 70
    when 'officer' then 60
    when 'member' then 10
    else 0
  end;
$$;

create or replace function public.is_sc_owner()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.sc_site_owners
    where discord_user_id = public.current_discord_id()
  );
$$;

create or replace function public.has_clan_access(target_clan_id text, min_level text default 'member')
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select public.is_sc_owner()
    or exists (
      select 1
      from public.sc_clan_access a
      where a.clan_id = target_clan_id
        and a.discord_user_id = public.current_discord_id()
        and public.sc_role_weight(a.access_level) >= public.sc_role_weight(min_level)
    )
    or (
      public.sc_role_weight(min_level) <= public.sc_role_weight('member')
      and exists (
        select 1
        from public.sc_clan_members m
        where m.clan_id = target_clan_id
          and m.discord_user_id = public.current_discord_id()
          and m.is_active = true
      )
    );
$$;

create or replace function public.has_guild_access(target_guild_id text, min_level text default 'member')
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select public.is_sc_owner()
    or exists (
      select 1
      from public.sc_guild_admins a
      where a.guild_id = target_guild_id
        and a.discord_user_id = public.current_discord_id()
        and public.sc_role_weight(a.access_level) >= public.sc_role_weight(min_level)
    )
    or exists (
      select 1
      from public.sc_guild_settings s
      join public.sc_clan_access ca on ca.clan_id = s.clan_id
      where s.guild_id = target_guild_id
        and ca.discord_user_id = public.current_discord_id()
        and public.sc_role_weight(ca.access_level) >= public.sc_role_weight(min_level)
    );
$$;

create or replace function public.is_stalcraft_linked()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.sc_players p
    where p.discord_user_id = public.current_discord_id()
      and p.selected_character_id is not null
  );
$$;

create view public.sc_clan_attendance_stats
with (security_invoker = true)
as
select
  cm.clan_id,
  cm.discord_user_id,
  coalesce(max(cm.character_name), max(p.selected_character_name), cm.discord_user_id) as character_name,
  max(cm.rank) as rank,
  count(a.id) filter (where a.status = 'attending') as attended_count,
  count(a.id) filter (where a.status = 'absent') as absent_count,
  count(a.id) as answered_count,
  max(a.responded_at) as last_response_at
from public.sc_clan_members cm
left join public.sc_players p on p.discord_user_id = cm.discord_user_id
left join public.sc_cw_attendance a
  on a.clan_id = cm.clan_id
 and a.discord_user_id = cm.discord_user_id
where cm.is_active = true
group by cm.clan_id, cm.discord_user_id;

do $$
declare
  t text;
begin
  foreach t in array array[
    'sc_site_owners',
    'sc_guilds',
    'sc_guild_admins',
    'sc_discord_channels',
    'sc_discord_roles',
    'sc_guild_settings',
    'sc_roles',
    'sc_game_balances',
    'sc_game_transactions',
    'sc_clans',
    'sc_players',
    'sc_friends',
    'sc_character_cache',
    'sc_clan_members',
    'sc_clan_access',
    'sc_equipment',
    'sc_profile_showcases',
    'sc_cw_sessions',
    'sc_cw_squads',
    'sc_cw_squad_members',
    'sc_cw_attendance',
    'sc_cw_result_queue',
    'sc_cw_result_audit',
    'sc_emission_state',
    'sc_logs',
    'sc_admin_audit_logs',
    'sc_admin_bot_actions',
    'sc_admin_bot_flags',
    'sc_admin_guild_notes'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy owner_full on public.%I for all to authenticated using (public.is_sc_owner()) with check (public.is_sc_owner())',
      t
    );
  end loop;
end $$;

create policy site_owners_select_self on public.sc_site_owners
for select to authenticated
using (discord_user_id = public.current_discord_id());

create policy guilds_read_available_or_access on public.sc_guilds
for select to authenticated
using (is_available = true or public.has_guild_access(guild_id, 'member'));

create policy guild_admins_read on public.sc_guild_admins
for select to authenticated
using (discord_user_id = public.current_discord_id() or public.has_guild_access(guild_id, 'admin'));

create policy channels_read_by_guild_access on public.sc_discord_channels
for select to authenticated
using (public.has_guild_access(guild_id, 'member'));

create policy roles_read_by_guild_access on public.sc_discord_roles
for select to authenticated
using (public.has_guild_access(guild_id, 'member'));

create policy settings_read_by_guild_access on public.sc_guild_settings
for select to authenticated
using (public.has_guild_access(guild_id, 'member'));

create policy settings_insert_by_officers on public.sc_guild_settings
for insert to authenticated
with check (public.has_guild_access(guild_id, 'officer'));

create policy settings_update_by_officers on public.sc_guild_settings
for update to authenticated
using (public.has_guild_access(guild_id, 'officer'))
with check (public.has_guild_access(guild_id, 'officer'));

create policy sc_roles_read_by_guild_access on public.sc_roles
for select to authenticated
using (public.has_guild_access(guild_id, 'member'));

create policy sc_roles_write_by_officers on public.sc_roles
for all to authenticated
using (public.has_guild_access(guild_id, 'officer'))
with check (public.has_guild_access(guild_id, 'officer'));

create policy clans_read_by_members on public.sc_clans
for select to authenticated
using (public.has_clan_access(clan_id, 'member'));

create policy clans_insert_linked on public.sc_clans
for insert to authenticated
with check (created_by_discord_user_id = public.current_discord_id() or public.is_sc_owner());

create policy clans_update_by_leaders on public.sc_clans
for update to authenticated
using (public.has_clan_access(clan_id, 'leader'))
with check (public.has_clan_access(clan_id, 'leader'));

create policy players_own_select on public.sc_players
for select to authenticated
using (discord_user_id = public.current_discord_id() or auth_user_id = auth.uid());

create policy players_own_insert on public.sc_players
for insert to authenticated
with check (discord_user_id = public.current_discord_id() or auth_user_id = auth.uid());

create policy players_own_update on public.sc_players
for update to authenticated
using (discord_user_id = public.current_discord_id() or auth_user_id = auth.uid())
with check (discord_user_id = public.current_discord_id() or auth_user_id = auth.uid());

create policy players_own_delete on public.sc_players
for delete to authenticated
using (discord_user_id = public.current_discord_id() or auth_user_id = auth.uid());

create policy game_balances_own_select on public.sc_game_balances
for select to authenticated
using (discord_user_id = public.current_discord_id());

create policy game_transactions_own_select on public.sc_game_transactions
for select to authenticated
using (discord_user_id = public.current_discord_id());

create policy friends_own_select on public.sc_friends
for select to authenticated
using (
  discord_user_id = public.current_discord_id()
  or friend_discord_user_id = public.current_discord_id()
);

create policy character_cache_read on public.sc_character_cache
for select to authenticated
using (
  discord_user_id = public.current_discord_id()
  or public.has_clan_access(clan_id, 'member')
);

create policy clan_members_read_by_clan on public.sc_clan_members
for select to authenticated
using (
  discord_user_id = public.current_discord_id()
  or public.has_clan_access(clan_id, 'member')
);

create policy clan_members_manage_by_officers on public.sc_clan_members
for all to authenticated
using (public.has_clan_access(clan_id, 'officer'))
with check (public.has_clan_access(clan_id, 'officer'));

create policy clan_access_read_by_clan on public.sc_clan_access
for select to authenticated
using (
  discord_user_id = public.current_discord_id()
  or public.has_clan_access(clan_id, 'member')
);

create policy clan_access_manage_by_leaders on public.sc_clan_access
for all to authenticated
using (public.has_clan_access(clan_id, 'leader'))
with check (public.has_clan_access(clan_id, 'leader'));

create policy equipment_read on public.sc_equipment
for select to authenticated
using (
  discord_user_id = public.current_discord_id()
  or exists (
    select 1
    from public.sc_players p
    where p.discord_user_id = sc_equipment.discord_user_id
      and public.has_clan_access(coalesce(p.clan_id, p.selected_clan_id), 'member')
  )
);

create policy equipment_write_own on public.sc_equipment
for all to authenticated
using (discord_user_id = public.current_discord_id())
with check (discord_user_id = public.current_discord_id());

create policy showcase_read on public.sc_profile_showcases
for select to authenticated
using (
  visibility = 'public'
  or discord_user_id = public.current_discord_id()
  or (
    visibility = 'clan'
    and exists (
      select 1
      from public.sc_players p
      where p.discord_user_id = sc_profile_showcases.discord_user_id
        and public.has_clan_access(coalesce(p.clan_id, p.selected_clan_id), 'member')
    )
  )
);

create policy showcase_own_write on public.sc_profile_showcases
for all to authenticated
using (discord_user_id = public.current_discord_id())
with check (discord_user_id = public.current_discord_id());

create policy cw_sessions_read on public.sc_cw_sessions
for select to authenticated
using (
  public.has_guild_access(guild_id, 'member')
  or public.has_clan_access(clan_id, 'member')
);

create policy cw_sessions_write on public.sc_cw_sessions
for all to authenticated
using (
  public.has_guild_access(guild_id, 'officer')
  or public.has_clan_access(clan_id, 'officer')
)
with check (
  public.has_guild_access(guild_id, 'officer')
  or public.has_clan_access(clan_id, 'officer')
);

create policy cw_squads_read_access on public.sc_cw_squads
for select to authenticated
using (
  public.has_guild_access(guild_id, 'member')
  or public.has_clan_access(clan_id, 'member')
);

create policy cw_squads_write_officers on public.sc_cw_squads
for all to authenticated
using (
  public.has_guild_access(guild_id, 'officer')
  or public.has_clan_access(clan_id, 'officer')
)
with check (
  public.has_guild_access(guild_id, 'officer')
  or public.has_clan_access(clan_id, 'officer')
);

create policy cw_squad_members_read_access on public.sc_cw_squad_members
for select to authenticated
using (
  exists (
    select 1
    from public.sc_cw_squads squad
    where squad.id = squad_id
      and (
        public.has_guild_access(squad.guild_id, 'member')
        or public.has_clan_access(squad.clan_id, 'member')
      )
  )
);

create policy cw_squad_members_write_officers on public.sc_cw_squad_members
for all to authenticated
using (
  exists (
    select 1
    from public.sc_cw_squads squad
    where squad.id = squad_id
      and (
        public.has_guild_access(squad.guild_id, 'officer')
        or public.has_clan_access(squad.clan_id, 'officer')
      )
  )
)
with check (
  exists (
    select 1
    from public.sc_cw_squads squad
    where squad.id = squad_id
      and (
        public.has_guild_access(squad.guild_id, 'officer')
        or public.has_clan_access(squad.clan_id, 'officer')
      )
  )
);

create policy attendance_read on public.sc_cw_attendance
for select to authenticated
using (
  discord_user_id = public.current_discord_id()
  or public.has_guild_access(guild_id, 'member')
  or public.has_clan_access(clan_id, 'member')
);

create policy attendance_own_insert on public.sc_cw_attendance
for insert to authenticated
with check (
  discord_user_id = public.current_discord_id()
  or public.has_guild_access(guild_id, 'officer')
  or public.has_clan_access(clan_id, 'officer')
);

create policy attendance_own_update on public.sc_cw_attendance
for update to authenticated
using (
  discord_user_id = public.current_discord_id()
  or public.has_guild_access(guild_id, 'officer')
  or public.has_clan_access(clan_id, 'officer')
)
with check (
  discord_user_id = public.current_discord_id()
  or public.has_guild_access(guild_id, 'officer')
  or public.has_clan_access(clan_id, 'officer')
);

create policy result_queue_read on public.sc_cw_result_queue
for select to authenticated
using (
  public.has_guild_access(guild_id, 'member')
  or public.has_clan_access(clan_id, 'member')
);

create policy result_queue_write on public.sc_cw_result_queue
for all to authenticated
using (
  public.has_guild_access(guild_id, 'officer')
  or public.has_clan_access(clan_id, 'officer')
)
with check (
  public.has_guild_access(guild_id, 'officer')
  or public.has_clan_access(clan_id, 'officer')
);

create policy result_audit_read on public.sc_cw_result_audit
for select to authenticated
using (
  public.has_guild_access(guild_id, 'member')
  or public.has_clan_access(clan_id, 'member')
);

create policy emission_read on public.sc_emission_state
for select to authenticated
using (public.has_guild_access(guild_id, 'member'));

create policy emission_write on public.sc_emission_state
for all to authenticated
using (public.has_guild_access(guild_id, 'officer'))
with check (public.has_guild_access(guild_id, 'officer'));

create policy logs_read on public.sc_logs
for select to authenticated
using (
  public.has_guild_access(guild_id, 'member')
  or public.has_clan_access(clan_id, 'member')
);

create policy logs_insert_by_staff on public.sc_logs
for insert to authenticated
with check (
  public.has_guild_access(guild_id, 'officer')
  or public.has_clan_access(clan_id, 'officer')
);

create policy admin_audit_owner_read on public.sc_admin_audit_logs
for select to authenticated
using (public.is_sc_owner());

create policy admin_audit_owner_insert on public.sc_admin_audit_logs
for insert to authenticated
with check (public.is_sc_owner());

create policy admin_bot_actions_owner_all on public.sc_admin_bot_actions
for all to authenticated
using (public.is_sc_owner())
with check (public.is_sc_owner());

create policy admin_flags_owner_all on public.sc_admin_bot_flags
for all to authenticated
using (public.is_sc_owner())
with check (public.is_sc_owner());

create policy admin_guild_notes_owner_all on public.sc_admin_guild_notes
for all to authenticated
using (public.is_sc_owner())
with check (public.is_sc_owner());

grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on public.sc_clan_attendance_stats to authenticated;
grant all on all tables in schema public to service_role;
grant execute on all functions in schema public to authenticated, service_role;

do $$
begin
  begin
    alter publication supabase_realtime add table public.sc_guild_settings;
  exception when duplicate_object then
    null;
  end;

  begin
    alter publication supabase_realtime add table public.sc_roles;
  exception when duplicate_object then
    null;
  end;

  begin
    alter publication supabase_realtime add table public.sc_admin_bot_actions;
  exception when duplicate_object then
    null;
  end;

  begin
    alter publication supabase_realtime add table public.sc_guilds;
  exception when duplicate_object then
    null;
  end;
end $$;

commit;

-- Run this after commit with your real Discord user ID:
-- insert into public.sc_site_owners (discord_user_id, note)
-- values ('YOUR_DISCORD_ID', 'main owner')
-- on conflict (discord_user_id) do nothing;
