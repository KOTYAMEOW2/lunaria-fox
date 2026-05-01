alter table public.sc_cw_result_queue
  add column if not exists matches_count integer not null default 1;

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
