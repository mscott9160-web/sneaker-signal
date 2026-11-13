-- Behavioral RLS checks. Run after all migrations against an ISOLATED database
-- (local `npx supabase db reset` or a throwaway development project), never production.
-- Everything runs inside a transaction that is rolled back, so no rows persist.
--
--   psql "$DEV_DATABASE_URL" -v ON_ERROR_STOP=1 -f docs/rls-behavior-test.sql
--
-- Any failed expectation raises an exception and aborts the run.

begin;

-- Fixtures (created as the table owner, bypassing RLS).
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-00000000000a', 'rls-user-a@example.test'),
  ('00000000-0000-4000-8000-00000000000b', 'rls-user-b@example.test'),
  ('00000000-0000-4000-8000-00000000000e', 'rls-editor@example.test');

insert into public.profiles (id) values
  ('00000000-0000-4000-8000-00000000000a'),
  ('00000000-0000-4000-8000-00000000000b'),
  ('00000000-0000-4000-8000-00000000000e')
on conflict (id) do nothing;
update public.profiles set role = 'editor' where id = '00000000-0000-4000-8000-00000000000e';

insert into public.brands (name, slug, supported) values ('RLS Test Brand', 'rls-test-brand', true)
on conflict (slug) do nothing;
insert into public.products (brand_id, name, slug)
select id, 'RLS Test Shoe', 'rls-test-shoe' from public.brands where slug = 'rls-test-brand';

insert into public.releases (id, product_id, region, release_at, release_timezone, status, editorial_status, last_verified_at)
select '00000000-0000-4000-8000-0000000000a1', id, 'US', now() + interval '3 days', 'America/New_York', 'confirmed', 'published', now()
from public.products where slug = 'rls-test-shoe';
insert into public.releases (id, product_id, region, release_at, release_timezone, status, editorial_status)
select '00000000-0000-4000-8000-0000000000d1', id, 'US', now() + interval '5 days', 'America/New_York', 'tentative', 'needs_review'
from public.products where slug = 'rls-test-shoe';

insert into public.saved_releases (user_id, release_id) values
  ('00000000-0000-4000-8000-00000000000b', '00000000-0000-4000-8000-0000000000a1');

-- 1. Anonymous visitors see published releases only and cannot write.
set local role anon;
set local request.jwt.claim.sub = '';
do $$
begin
  if not exists (select 1 from public.releases where id = '00000000-0000-4000-8000-0000000000a1') then
    raise exception 'anon cannot read a published release';
  end if;
  if exists (select 1 from public.releases where id = '00000000-0000-4000-8000-0000000000d1') then
    raise exception 'anon can read an unpublished (needs_review) release';
  end if;
  begin
    update public.releases set retail_price = 1 where id = '00000000-0000-4000-8000-0000000000a1';
    raise exception 'anon was allowed to update a release';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.saved_releases;
    raise exception 'anon was allowed to read saved_releases';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- 2. Signed-in user A is isolated from user B.
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-00000000000a';
do $$
declare
  affected integer;
begin
  if exists (select 1 from public.saved_releases where user_id = '00000000-0000-4000-8000-00000000000b') then
    raise exception 'user A can read user B saved releases';
  end if;
  if exists (select 1 from public.notification_preferences where user_id <> '00000000-0000-4000-8000-00000000000a') then
    raise exception 'user A can read another user''s notification preferences';
  end if;

  insert into public.saved_releases (user_id, release_id)
  values ('00000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-0000000000a1');

  begin
    insert into public.saved_releases (user_id, release_id)
    values ('00000000-0000-4000-8000-00000000000b', '00000000-0000-4000-8000-0000000000a1');
    raise exception 'user A inserted a save on behalf of user B';
  exception when insufficient_privilege or unique_violation then null;
  end;

  delete from public.saved_releases where user_id = '00000000-0000-4000-8000-00000000000b';
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'user A deleted user B saved releases';
  end if;

  update public.notification_preferences set email_enabled = false
  where user_id = '00000000-0000-4000-8000-00000000000b';
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'user A updated user B notification preferences';
  end if;

  if public.is_editor() then
    raise exception 'regular user is treated as an editor';
  end if;
end $$;
reset role;

-- 3. User B's data survived user A's attempts.
do $$
begin
  if not exists (select 1 from public.saved_releases where user_id = '00000000-0000-4000-8000-00000000000b') then
    raise exception 'user B saved release was removed by another user';
  end if;
end $$;

-- 4. Editors are recognised by the role helper.
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-00000000000e';
do $$
begin
  if not public.is_editor() then
    raise exception 'editor role is not recognised';
  end if;
end $$;
reset role;

-- 5. A user cannot promote themselves to editor through the API.
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-00000000000a';
do $$
begin
  begin
    update public.profiles set role = 'editor' where id = '00000000-0000-4000-8000-00000000000a';
  exception when insufficient_privilege or check_violation then null;
  end;
end $$;
reset role;
do $$
begin
  if (select role from public.profiles where id = '00000000-0000-4000-8000-00000000000a') <> 'user' then
    raise exception 'user escalated their own role to editor';
  end if;
end $$;

-- 6. Reminder candidate data is readable by the service role only.
set local role service_role;
do $$
begin
  if not exists (select 1 from public.saved_releases) then
    raise exception 'service_role cannot read saved releases for reminders';
  end if;
end $$;
reset role;

rollback;

\echo 'RLS behavior checks passed.'
