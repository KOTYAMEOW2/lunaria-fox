do $$
begin
  if to_regclass('public.sc_cw_squads') is null then
    raise exception 'public.sc_cw_squads does not exist. Run the fresh STALCRAFT schema first.';
  end if;
end $$;

create or replace function public.enforce_sc_cw_squad_limit()
returns trigger
language plpgsql
as $$
declare
  existing_count integer;
begin
  select count(*)
    into existing_count
    from public.sc_cw_squads
   where guild_id = new.guild_id;

  if existing_count >= 7 then
    raise exception 'Only 7 CW squads are allowed per guild.';
  end if;

  return new;
end;
$$;

drop trigger if exists sc_cw_squads_limit_before_insert on public.sc_cw_squads;

create trigger sc_cw_squads_limit_before_insert
before insert on public.sc_cw_squads
for each row execute function public.enforce_sc_cw_squad_limit();

grant execute on function public.enforce_sc_cw_squad_limit() to authenticated, service_role;
