-- Behavioral checks for the editor workflow functions (migration 202611130003).
-- Run against an ISOLATED database only; everything is rolled back.
--
--   psql "$DEV_DATABASE_URL" -v ON_ERROR_STOP=1 -f docs/editor-workflow-test.sql

begin;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000e1', 'editor-test@example.test'),
  ('00000000-0000-4000-8000-0000000000c1', 'reader-test@example.test');
insert into public.profiles (id) values
  ('00000000-0000-4000-8000-0000000000e1'),
  ('00000000-0000-4000-8000-0000000000c1')
on conflict (id) do nothing;
update public.profiles set role = 'editor' where id = '00000000-0000-4000-8000-0000000000e1';

create temporary table editor_test_state (key text primary key, value uuid);
grant all on editor_test_state to authenticated, anon;

-- 1. A regular signed-in user cannot use the editor functions.
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-0000000000c1';
do $$
begin
  begin
    perform public.editor_save_release('{"brand_slug": "nike", "product_name": "Nope"}');
    raise exception 'regular user saved a release';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-0000000000e1';
do $$
declare
  v_id uuid;
  v_retailer uuid := (select id from public.retailers order by name limit 1);
  v_message text;
begin
  -- 2. Drafts need no source and stay hidden.
  v_id := public.editor_save_release(jsonb_build_object(
    'brand_slug', 'nike', 'product_name', 'Editor Test Runner', 'colorway', 'Black / White',
    'release_at', '2026-12-05T15:00:00Z', 'retail_price', '150', 'status', 'confirmed',
    'editorial_status', 'needs_review'));
  insert into editor_test_state values ('release', v_id);
  if (select editorial_status from public.releases where id = v_id) <> 'needs_review' then
    raise exception 'draft was not saved as needs_review';
  end if;

  -- 3. Publishing a confirmed release without a source or retailer is refused.
  begin
    perform public.editor_set_release_state(v_id, 'published');
    raise exception 'published without a source';
  exception when invalid_parameter_value then
    get stacked diagnostics v_message = message_text;
    if v_message not like 'Add a verified source%' then raise exception 'unexpected message: %', v_message; end if;
  end;

  -- 4. Non-HTTPS links are refused.
  begin
    perform public.editor_save_release(jsonb_build_object('release_id', v_id,
      'release_at', '2026-12-05T15:00:00Z', 'retail_price', '150', 'status', 'confirmed',
      'source_publisher', 'Nike', 'source_url', 'http://nike.com/launch', 'source_tier', 1));
    raise exception 'accepted an http source';
  exception when invalid_parameter_value then null;
  end;

  -- 5. A tier 4 source alone cannot publish a confirmed release.
  begin
    perform public.editor_save_release(jsonb_build_object('release_id', v_id,
      'release_at', '2026-12-05T15:00:00Z', 'retail_price', '150', 'status', 'confirmed',
      'source_type', 'editorial', 'source_publisher', 'A blog', 'source_url', 'https://blog.example/post',
      'source_tier', 4, 'retailer_id', v_retailer, 'retailer_url', 'https://shop.example/p',
      'editorial_status', 'published'));
    raise exception 'published a confirmed release from a tier 4 source';
  exception when invalid_parameter_value then null;
  end;
  -- That failed save must have rolled back completely (no source attached).
  if exists (select 1 from public.release_sources where release_id = v_id) then
    raise exception 'failed save left a source behind';
  end if;

  -- 6. Brand source + retailer link publishes in one save.
  perform public.editor_save_release(jsonb_build_object('release_id', v_id,
    'release_at', '2026-12-05T15:00:00Z', 'retail_price', '150', 'status', 'confirmed',
    'source_type', 'brand', 'source_publisher', 'Nike SNKRS', 'source_url', 'https://www.nike.com/launch/t/test',
    'source_tier', 1, 'retailer_id', v_retailer, 'retailer_url', 'https://www.nike.com/launch/t/test',
    'editorial_status', 'published', 'reason', 'Checked SNKRS page'));
  if (select editorial_status from public.releases where id = v_id) <> 'published' then
    raise exception 'release was not published';
  end if;
  if (select last_verified_at from public.releases where id = v_id) is null then
    raise exception 'publishing did not set last_verified_at';
  end if;

  -- 7. Archiving requires a reason.
  begin
    perform public.editor_set_release_state(v_id, 'archived');
    raise exception 'archived without a reason';
  exception when invalid_parameter_value then null;
  end;
end $$;
reset role;

-- 8. Signed-out visitors see the published release.
set local role anon;
set local request.jwt.claim.sub = '';
do $$
begin
  if not exists (select 1 from public.releases where id = (select value from editor_test_state where key = 'release')) then
    raise exception 'anon cannot see the published release';
  end if;
end $$;
reset role;

-- 9. Postponing keeps it public; archiving hides it.
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-0000000000e1';
do $$
declare
  v_id uuid := (select value from editor_test_state where key = 'release');
begin
  perform public.editor_set_release_state(v_id, null, 'postponed', 'Brand moved the date');
  if (select status from public.releases where id = v_id) <> 'postponed' then
    raise exception 'status change was not applied';
  end if;
  perform public.editor_set_release_state(v_id, 'archived', null, 'Withdrawn by brand');
end $$;
reset role;

set local role anon;
set local request.jwt.claim.sub = '';
do $$
begin
  if exists (select 1 from public.releases where id = (select value from editor_test_state where key = 'release')) then
    raise exception 'anon can still see the archived release';
  end if;
end $$;
reset role;

-- 10. Every successful change was audited with the editor's id.
do $$
declare
  v_id uuid := (select value from editor_test_state where key = 'release');
begin
  if (select count(*) from public.editorial_changes where record_id = v_id
      and editor_id = '00000000-0000-4000-8000-0000000000e1') <> 4 then
    raise exception 'expected 4 audit rows, found %',
      (select count(*) from public.editorial_changes where record_id = v_id);
  end if;
end $$;

rollback;

\echo 'Editor workflow checks passed.'
