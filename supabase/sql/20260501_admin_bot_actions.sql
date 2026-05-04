-- Add admin bot action queue for already-created STALCRAFT schema.
-- Run this if you already executed 20260501_stalcraft_fresh_schema.sql before this table existed.

begin;

create table if not exists public.sc_admin_bot_actions (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null references public.sc_guilds(guild_id) on delete cascade,
  action text not null check (action in ('leave_guild')),
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

create index if not exists sc_admin_bot_actions_pending_idx
  on public.sc_admin_bot_actions(status, created_at);

create index if not exists sc_admin_bot_actions_guild_idx
  on public.sc_admin_bot_actions(guild_id, created_at desc);

drop trigger if exists sc_admin_bot_actions_touch on public.sc_admin_bot_actions;
create trigger sc_admin_bot_actions_touch
before update on public.sc_admin_bot_actions
for each row execute function public.touch_updated_at();

alter table public.sc_admin_bot_actions enable row level security;

drop policy if exists owner_full on public.sc_admin_bot_actions;
create policy owner_full on public.sc_admin_bot_actions
for all to authenticated
using (public.is_sc_owner())
with check (public.is_sc_owner());

drop policy if exists admin_bot_actions_owner_all on public.sc_admin_bot_actions;
create policy admin_bot_actions_owner_all on public.sc_admin_bot_actions
for all to authenticated
using (public.is_sc_owner())
with check (public.is_sc_owner());

grant select, insert, update, delete on public.sc_admin_bot_actions to authenticated;
grant all on public.sc_admin_bot_actions to service_role;

commit;
