-- Lunaria Fox · STALCRAFT MVP
-- Run this in Supabase SQL Editor before deploying the site/bot overlay.

create extension if not exists pgcrypto;

create table if not exists public.stalcraft_profiles (
  discord_user_id text primary key,
  exbo_id text not null,
  exbo_uuid text,
  exbo_login text,
  exbo_display_login text,
  access_token text,
  refresh_token text,
  token_type text default 'Bearer',
  token_expires_at timestamptz,
  selected_region text check (selected_region in ('RU', 'EU', 'NA', 'SEA')),
  selected_character_id text,
  selected_character_name text,
  selected_clan_id text,
  selected_clan_name text,
  selected_clan_rank text,
  linked_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stalcraft_characters_cache (
  discord_user_id text not null,
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
  raw jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (discord_user_id, region, character_id)
);

create table if not exists public.stalcraft_guild_settings (
  guild_id text primary key,
  enabled boolean not null default false,
  commands_enabled boolean not null default true,
  video_enabled boolean not null default true,
  community_name text,
  required_clan_id text,
  required_clan_name text,
  verified_role_id text,
  verified_role_name text not null default 'STALCRAFT Verified',
  role_auto_create boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by text
);

create table if not exists public.stalcraft_videos (
  id uuid primary key default gen_random_uuid(),
  guild_id text,
  discord_user_id text not null,
  author_name text,
  character_id text,
  character_name text,
  region text check (region in ('RU', 'EU', 'NA', 'SEA')),
  title text not null check (char_length(title) between 1 and 160),
  description text,
  video_url text,
  storage_path text,
  thumbnail_url text,
  status text not null default 'published' check (status in ('published', 'hidden', 'deleted', 'pending')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists stalcraft_profiles_selected_character_idx
  on public.stalcraft_profiles (selected_region, selected_character_id);

create index if not exists stalcraft_videos_status_created_idx
  on public.stalcraft_videos (status, created_at desc);

create index if not exists stalcraft_videos_guild_idx
  on public.stalcraft_videos (guild_id, created_at desc);

-- The app uses service-role routes, so direct client RLS is not required for the MVP.
-- Keep RLS disabled unless you later expose these tables directly to browser Supabase client.
