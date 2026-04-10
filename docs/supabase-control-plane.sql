create table if not exists public.dashboard_sync_states (
  guild_id text primary key,
  revision bigint not null default 0,
  requested_at timestamptz null,
  requested_by text null,
  requested_source text not null default 'dashboard',
  last_section text null,
  changed_keys jsonb not null default '[]'::jsonb,
  site_updated_at timestamptz null,
  bot_seen_at timestamptz null,
  bot_applied_at timestamptz null,
  bot_applied_revision bigint not null default 0,
  status text not null default 'idle',
  last_error text null,
  meta jsonb not null default '{}'::jsonb
);

create index if not exists idx_dashboard_sync_states_status_requested_at
  on public.dashboard_sync_states (status, requested_at desc);

create index if not exists idx_dashboard_sync_states_bot_applied_revision
  on public.dashboard_sync_states (bot_applied_revision desc);
