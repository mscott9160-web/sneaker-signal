-- Run after `npx supabase db reset` against the local Supabase database.
-- This is intentionally read-only and verifies the SS-001/SS-002 foundation.

do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'app_role'
  ) then
    raise exception 'public.app_role is missing';
  end if;

  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'is_editor') then
    raise exception 'profiles.is_editor still exists';
  end if;

  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'role') then
    raise exception 'profiles.role is missing';
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'releases' and policyname = 'Editors can manage releases') then
    raise exception 'editor release policy is missing';
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'articles' and policyname = 'Editors can manage articles') then
    raise exception 'editor article policy is missing';
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'releases' and policyname = 'Public can read published releases') then
    raise exception 'public release-read policy is missing';
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'saved_releases' and policyname = 'Users can manage own saved releases') then
    raise exception 'saved-release ownership policy is missing';
  end if;
end;
$$;