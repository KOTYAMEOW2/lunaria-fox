-- Run this if CW squads cannot be created and Supabase returns 404 for sc_cw_squads.
-- It is safe to run more than once.

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

create index if not exists sc_cw_squads_guild_idx on public.sc_cw_squads(guild_id, updated_at desc);
create index if not exists sc_cw_squads_clan_idx on public.sc_cw_squads(clan_id);
create index if not exists sc_cw_squad_members_user_idx on public.sc_cw_squad_members(discord_user_id);

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'sc_cw_squads_touch'
  ) then
    create trigger sc_cw_squads_touch
    before update on public.sc_cw_squads
    for each row execute function public.touch_updated_at();
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'sc_cw_squad_members_touch'
  ) then
    create trigger sc_cw_squad_members_touch
    before update on public.sc_cw_squad_members
    for each row execute function public.touch_updated_at();
  end if;
end $$;

alter table public.sc_cw_squads enable row level security;
alter table public.sc_cw_squad_members enable row level security;

drop policy if exists cw_squads_read_access on public.sc_cw_squads;
create policy cw_squads_read_access on public.sc_cw_squads
for select to authenticated
using (
  public.has_guild_access(guild_id, 'member')
  or public.has_clan_access(clan_id, 'member')
);

drop policy if exists cw_squads_write_officers on public.sc_cw_squads;
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

grant select, insert, update, delete on public.sc_cw_squads to authenticated;
grant select, insert, update, delete on public.sc_cw_squad_members to authenticated;
grant all on public.sc_cw_squads to service_role;
grant all on public.sc_cw_squad_members to service_role;

do $$
begin
  begin
    alter publication supabase_realtime add table public.sc_cw_squads;
  exception when duplicate_object then
    null;
  end;

  begin
    alter publication supabase_realtime add table public.sc_cw_squad_members;
  exception when duplicate_object then
    null;
  end;
end $$;

notify pgrst, 'reload schema';
