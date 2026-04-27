create table if not exists public.guild_premium_settings (
  guild_id text primary key,
  premium_active boolean not null default false,
  plan_name text not null default 'free',
  features jsonb not null default '[]'::jsonb,
  welcome_settings jsonb not null default '{}'::jsonb,
  server_panel_settings jsonb not null default '{}'::jsonb,
  analytics_settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists idx_guild_premium_settings_premium_active
  on public.guild_premium_settings (premium_active);

create table if not exists public.brand_roles (
  guild_id text primary key,
  role_id text null,
  role_name text not null default 'L U N A R I A   F O X',
  color text not null default '#9c7cff',
  hoist boolean not null default true,
  mentionable boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.bot_analytics (
  id bigint generated always as identity primary key,
  guild_id text null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_bot_analytics_guild_id_created_at
  on public.bot_analytics (guild_id, created_at desc);

create index if not exists idx_bot_analytics_event_type_created_at
  on public.bot_analytics (event_type, created_at desc);
