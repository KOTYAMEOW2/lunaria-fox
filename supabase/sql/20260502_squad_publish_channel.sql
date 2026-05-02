begin;

alter table public.sc_guild_settings
add column if not exists squads_channel_id text;

notify pgrst, 'reload schema';

commit;
