-- Lunaria Fox STALCRAFT add-ons:
-- mini-games, registered friends, and CW squads.

create table if not exists public.sc_game_balances (
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

create table if not exists public.sc_game_transactions (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null references public.sc_guilds(guild_id) on delete cascade,
  discord_user_id text not null,
  amount bigint not null,
  reason text not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.sc_friends (
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

create table if not exists public.sc_cw_squads (
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

create table if not exists public.sc_cw_squad_members (
  squad_id uuid not null references public.sc_cw_squads(id) on delete cascade,
  discord_user_id text not null references public.sc_players(discord_user_id) on delete cascade,
  character_name text,
  assigned_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (squad_id, discord_user_id)
);

create index if not exists sc_game_transactions_user_idx on public.sc_game_transactions(guild_id, discord_user_id, created_at desc);
create index if not exists sc_friends_friend_idx on public.sc_friends(friend_discord_user_id);
create index if not exists sc_cw_squads_guild_idx on public.sc_cw_squads(guild_id, updated_at desc);
create index if not exists sc_cw_squads_clan_idx on public.sc_cw_squads(clan_id);
create index if not exists sc_cw_squad_members_user_idx on public.sc_cw_squad_members(discord_user_id);

drop trigger if exists sc_game_balances_touch on public.sc_game_balances;
create trigger sc_game_balances_touch before update on public.sc_game_balances
for each row execute function public.touch_updated_at();

drop trigger if exists sc_cw_squads_touch on public.sc_cw_squads;
create trigger sc_cw_squads_touch before update on public.sc_cw_squads
for each row execute function public.touch_updated_at();

drop trigger if exists sc_cw_squad_members_touch on public.sc_cw_squad_members;
create trigger sc_cw_squad_members_touch before update on public.sc_cw_squad_members
for each row execute function public.touch_updated_at();

alter table public.sc_game_balances enable row level security;
alter table public.sc_game_transactions enable row level security;
alter table public.sc_friends enable row level security;
alter table public.sc_cw_squads enable row level security;
alter table public.sc_cw_squad_members enable row level security;

drop policy if exists game_balances_own_select on public.sc_game_balances;
create policy game_balances_own_select on public.sc_game_balances
for select to authenticated
using (discord_user_id = public.current_discord_id() or public.is_sc_owner());

drop policy if exists game_transactions_own_select on public.sc_game_transactions;
create policy game_transactions_own_select on public.sc_game_transactions
for select to authenticated
using (discord_user_id = public.current_discord_id() or public.is_sc_owner());

drop policy if exists friends_own_select on public.sc_friends;
create policy friends_own_select on public.sc_friends
for select to authenticated
using (
  discord_user_id = public.current_discord_id()
  or friend_discord_user_id = public.current_discord_id()
  or public.is_sc_owner()
);

drop policy if exists cw_squads_read_access on public.sc_cw_squads;
create policy cw_squads_read_access on public.sc_cw_squads
for select to authenticated
using (
  public.has_guild_access(guild_id, 'member')
  or public.has_clan_access(clan_id, 'member')
  or public.is_sc_owner()
);

drop policy if exists cw_squads_write_officers on public.sc_cw_squads;
create policy cw_squads_write_officers on public.sc_cw_squads
for all to authenticated
using (
  public.has_guild_access(guild_id, 'officer')
  or public.has_clan_access(clan_id, 'officer')
  or public.is_sc_owner()
)
with check (
  public.has_guild_access(guild_id, 'officer')
  or public.has_clan_access(clan_id, 'officer')
  or public.is_sc_owner()
);

drop policy if exists cw_squad_members_read_access on public.sc_cw_squad_members;
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
        or public.is_sc_owner()
      )
  )
);

drop policy if exists cw_squad_members_write_officers on public.sc_cw_squad_members;
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
        or public.is_sc_owner()
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
        or public.is_sc_owner()
      )
  )
);

grant select, insert, update, delete on public.sc_game_balances to authenticated;
grant select, insert, update, delete on public.sc_game_transactions to authenticated;
grant select, insert, update, delete on public.sc_friends to authenticated;
grant select, insert, update, delete on public.sc_cw_squads to authenticated;
grant select, insert, update, delete on public.sc_cw_squad_members to authenticated;

grant all on public.sc_game_balances to service_role;
grant all on public.sc_game_transactions to service_role;
grant all on public.sc_friends to service_role;
grant all on public.sc_cw_squads to service_role;
grant all on public.sc_cw_squad_members to service_role;
