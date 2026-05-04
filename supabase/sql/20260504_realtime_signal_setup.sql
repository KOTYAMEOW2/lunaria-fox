begin;

do $$
begin
  begin
    alter publication supabase_realtime add table public.sc_discord_channels;
  exception when duplicate_object then
    null;
  end;

  begin
    alter publication supabase_realtime add table public.sc_discord_roles;
  exception when duplicate_object then
    null;
  end;

  begin
    alter publication supabase_realtime add table public.sc_emission_state;
  exception when duplicate_object then
    null;
  end;

  begin
    alter publication supabase_realtime add table public.sc_cw_sessions;
  exception when duplicate_object then
    null;
  end;

  begin
    alter publication supabase_realtime add table public.sc_cw_attendance;
  exception when duplicate_object then
    null;
  end;

  begin
    alter publication supabase_realtime add table public.sc_cw_result_queue;
  exception when duplicate_object then
    null;
  end;

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

create or replace function public.touch_sc_cw_squad_parent()
returns trigger
language plpgsql
as $$
declare
  target_squad_id uuid;
begin
  target_squad_id := coalesce(new.squad_id, old.squad_id);
  if target_squad_id is not null then
    update public.sc_cw_squads
    set updated_at = now()
    where id = target_squad_id;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists sc_cw_squad_members_touch_parent on public.sc_cw_squad_members;

create trigger sc_cw_squad_members_touch_parent
after insert or update or delete on public.sc_cw_squad_members
for each row execute function public.touch_sc_cw_squad_parent();

notify pgrst, 'reload schema';

commit;
