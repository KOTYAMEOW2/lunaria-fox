begin;

alter table public.sc_admin_bot_actions
drop constraint if exists sc_admin_bot_actions_action_check;

alter table public.sc_admin_bot_actions
add constraint sc_admin_bot_actions_action_check
check (action in ('leave_guild', 'send_cw_post'));

notify pgrst, 'reload schema';

commit;
