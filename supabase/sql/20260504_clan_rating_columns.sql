alter table public.sc_clans
  add column if not exists clan_level integer,
  add column if not exists clan_level_points integer,
  add column if not exists clan_member_count integer,
  add column if not exists clan_leader_name text,
  add column if not exists rating_score integer,
  add column if not exists rating_rank integer,
  add column if not exists rating_updated_at timestamptz;

create index if not exists sc_clans_rating_rank_idx
  on public.sc_clans(region, rating_rank)
  where rating_rank is not null;

create index if not exists sc_clans_rating_score_idx
  on public.sc_clans(region, rating_score desc)
  where rating_score is not null;

notify pgrst, 'reload schema';
