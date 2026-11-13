-- Behavioral checks for one-click unsubscribe (migration 202611130004).
-- Run against an ISOLATED database only; everything is rolled back.

begin;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000f1', 'unsub-a@example.test'),
  ('00000000-0000-4000-8000-0000000000f2', 'unsub-b@example.test');
insert into public.notification_preferences (user_id) values
  ('00000000-0000-4000-8000-0000000000f1'),
  ('00000000-0000-4000-8000-0000000000f2')
on conflict (user_id) do nothing;
update public.notification_preferences
set email_enabled = true, digest_enabled = true, restock_enabled = true
where user_id in ('00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000000f2');

create temporary table unsub_token as
select unsubscribe_token as token from public.notification_preferences
where user_id = '00000000-0000-4000-8000-0000000000f1';
grant select on unsub_token to anon, authenticated;

-- 1. A signed-out visitor with the token turns off every email for that user only.
set local role anon;
set local request.jwt.claim.sub = '';
do $$
begin
  if public.unsubscribe_by_token(gen_random_uuid()) then
    raise exception 'an unknown token reported success';
  end if;
  if not public.unsubscribe_by_token((select token from unsub_token)) then
    raise exception 'a valid token did not unsubscribe';
  end if;
  -- Repeating it is harmless (mail clients may retry).
  if not public.unsubscribe_by_token((select token from unsub_token)) then
    raise exception 'repeat unsubscribe failed';
  end if;
  begin
    perform 1 from public.notification_preferences;
    raise exception 'anon can read notification preferences';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

do $$
begin
  if exists (select 1 from public.notification_preferences
             where user_id = '00000000-0000-4000-8000-0000000000f1'
               and (email_enabled or digest_enabled or restock_enabled or unsubscribed_at is null)) then
    raise exception 'unsubscribe did not turn off all email or record the time';
  end if;
  if not exists (select 1 from public.notification_preferences
                 where user_id = '00000000-0000-4000-8000-0000000000f2' and email_enabled) then
    raise exception 'unsubscribe affected another user';
  end if;
end $$;

-- 2. Users cannot change their token or the opt-out timestamp.
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-0000000000f1';
do $$
begin
  begin
    update public.notification_preferences set unsubscribe_token = gen_random_uuid()
    where user_id = '00000000-0000-4000-8000-0000000000f1';
    raise exception 'user changed their unsubscribe token';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.notification_preferences set unsubscribed_at = null
    where user_id = '00000000-0000-4000-8000-0000000000f1';
    raise exception 'user cleared the opt-out timestamp directly';
  exception when insufficient_privilege then null;
  end;

  -- 3. Opting back in from settings clears the marker.
  update public.notification_preferences set email_enabled = true, updated_at = now()
  where user_id = '00000000-0000-4000-8000-0000000000f1';
end $$;
reset role;

do $$
begin
  if (select unsubscribed_at from public.notification_preferences
      where user_id = '00000000-0000-4000-8000-0000000000f1') is not null then
    raise exception 'opting back in did not clear unsubscribed_at';
  end if;
end $$;

rollback;

\echo 'Unsubscribe checks passed.'
