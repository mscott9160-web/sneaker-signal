-- In-app editorial workflow (backlog SS-002).
--
-- Editors never write catalog tables directly from the browser. Every change goes
-- through one of these SECURITY DEFINER functions so that:
--   * a release, its product, source and retailer launch are saved atomically,
--   * the publishing rules in docs/production-readiness.md are enforced on the server,
--   * every change is recorded in public.editorial_changes with a reason.
-- Each function first checks public.is_editor(), so a regular signed-in user gets
-- "permission denied" even though authenticated may EXECUTE them.

create or replace function public.is_https_url(value text)
returns boolean
language sql
immutable
as $$
  select value ~* '^https://[^\s/?#]+\.[^\s/?#]+([/?#]\S*)?$';
$$;

-- Returns null when the release may be published, otherwise a sentence an editor can act on.
create or replace function public.release_publish_problem(p_release_id uuid)
returns text
language plpgsql
stable
security definer set search_path = public
as $$
declare
  r public.releases;
  best_tier integer;
  retailer_count integer;
begin
  select * into r from public.releases where id = p_release_id;
  if not found then
    return 'Release not found.';
  end if;

  select min(s.reliability_tier) into best_tier
  from public.release_sources rs
  join public.sources s on s.id = rs.source_id
  where rs.release_id = p_release_id and rs.verification_status = 'verified';

  if best_tier is null then
    return 'Add a verified source before publishing.';
  end if;
  if best_tier > 4 then
    return 'AI-assisted and community sources (tier 5) cannot be the only source for a published release.';
  end if;

  if r.status = 'confirmed' then
    if r.release_at is null then
      return 'A confirmed release needs a launch date and time.';
    end if;
    if r.retail_price is null then
      return 'A confirmed release needs a retail price.';
    end if;
    if best_tier > 2 then
      return 'A confirmed release needs a brand (tier 1) or authorized retailer (tier 2) source. Use status "tentative" until one confirms it.';
    end if;
    select count(*) into retailer_count from public.retailer_launches where release_id = p_release_id;
    if retailer_count = 0 then
      return 'A confirmed release needs at least one official retailer link.';
    end if;
  end if;

  return null;
end;
$$;

create or replace function public.editor_save_release(p jsonb)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_release_id uuid := nullif(p ->> 'release_id', '')::uuid;
  v_target public.editorial_status := coalesce(nullif(p ->> 'editorial_status', ''), 'needs_review')::public.editorial_status;
  v_status public.release_status := coalesce(nullif(p ->> 'status', ''), 'tentative')::public.release_status;
  v_launch_type public.launch_type := coalesce(nullif(p ->> 'launch_type', ''), 'online')::public.launch_type;
  v_timezone text := coalesce(nullif(p ->> 'release_timezone', ''), 'America/New_York');
  v_release_at timestamptz := nullif(p ->> 'release_at', '')::timestamptz;
  v_price numeric := nullif(p ->> 'retail_price', '')::numeric;
  v_name text := btrim(coalesce(p ->> 'product_name', ''));
  v_colorway text := nullif(btrim(coalesce(p ->> 'colorway', '')), '');
  v_style_code text := nullif(btrim(coalesce(p ->> 'style_code', '')), '');
  v_image_url text := nullif(btrim(coalesce(p ->> 'image_url', '')), '');
  v_source_url text := nullif(btrim(coalesce(p ->> 'source_url', '')), '');
  v_source_publisher text := nullif(btrim(coalesce(p ->> 'source_publisher', '')), '');
  v_source_type public.source_type := coalesce(nullif(p ->> 'source_type', ''), 'brand')::public.source_type;
  v_source_tier integer := coalesce(nullif(p ->> 'source_tier', '')::integer, 1);
  v_retailer_id uuid := nullif(p ->> 'retailer_id', '')::uuid;
  v_retailer_url text := nullif(btrim(coalesce(p ->> 'retailer_url', '')), '');
  v_reason text := nullif(btrim(coalesce(p ->> 'reason', '')), '');
  v_brand_id uuid;
  v_product_id uuid;
  v_source_id uuid;
  v_before jsonb;
  v_problem text;
  v_editor uuid := auth.uid();
begin
  if not public.is_editor() then
    raise exception 'Only editors can manage releases.' using errcode = '42501';
  end if;

  if v_target not in ('needs_review', 'published') then
    raise exception 'Save a release as a draft or publish it. Use the archive action to remove it.' using errcode = '22023';
  end if;
  if v_status = 'expired' then
    raise exception 'Expired is set automatically; choose another status.' using errcode = '22023';
  end if;
  if v_price is not null and v_price < 0 then
    raise exception 'Retail price cannot be negative.' using errcode = '22023';
  end if;
  if not exists (select 1 from pg_timezone_names where name = v_timezone) then
    raise exception 'Unknown timezone "%".', v_timezone using errcode = '22023';
  end if;
  if v_image_url is not null and not public.is_https_url(v_image_url) then
    raise exception 'Image URL must start with https://' using errcode = '22023';
  end if;
  if v_source_url is not null and not public.is_https_url(v_source_url) then
    raise exception 'Source URL must start with https://' using errcode = '22023';
  end if;
  if v_retailer_url is not null and not public.is_https_url(v_retailer_url) then
    raise exception 'Retailer link must start with https://' using errcode = '22023';
  end if;
  if v_source_url is not null and v_source_publisher is null then
    raise exception 'Name the source publisher (for example "Nike SNKRS").' using errcode = '22023';
  end if;
  if v_source_tier not between 1 and 5 then
    raise exception 'Source tier must be between 1 and 5.' using errcode = '22023';
  end if;
  if (v_retailer_id is null) <> (v_retailer_url is null) then
    raise exception 'Choose a retailer and paste its product link together.' using errcode = '22023';
  end if;
  if v_retailer_id is not null and not exists (select 1 from public.retailers where id = v_retailer_id) then
    raise exception 'Unknown retailer.' using errcode = '22023';
  end if;

  if v_release_id is null then
    if v_name = '' then
      raise exception 'Model name is required.' using errcode = '22023';
    end if;
    select id into v_brand_id from public.brands where slug = p ->> 'brand_slug' and supported;
    if v_brand_id is null then
      raise exception 'Choose a supported brand.' using errcode = '22023';
    end if;

    insert into public.products (brand_id, name, slug, style_code, colorway, category, image_url)
    values (
      v_brand_id,
      v_name,
      trim(both '-' from regexp_replace(lower(v_name || '-' || coalesce(v_colorway, '')), '[^a-z0-9]+', '-', 'g'))
        || '-' || substr(md5(gen_random_uuid()::text), 1, 6),
      v_style_code,
      v_colorway,
      'lifestyle',
      v_image_url
    )
    returning id into v_product_id;

    insert into public.releases (product_id, release_at, release_timezone, retail_price, launch_type, status, editorial_status)
    values (v_product_id, v_release_at, v_timezone, v_price, v_launch_type, v_status, 'needs_review')
    returning id into v_release_id;
    v_before := null;
  else
    select to_jsonb(r) into v_before from public.releases r where r.id = v_release_id for update;
    if v_before is null then
      raise exception 'Release not found.' using errcode = 'P0002';
    end if;
    v_product_id := (v_before ->> 'product_id')::uuid;

    update public.products set
      name = coalesce(nullif(v_name, ''), name),
      colorway = v_colorway,
      style_code = v_style_code,
      image_url = v_image_url,
      updated_at = now()
    where id = v_product_id;

    update public.releases set
      release_at = v_release_at,
      release_timezone = v_timezone,
      retail_price = v_price,
      launch_type = v_launch_type,
      status = v_status,
      updated_at = now()
    where id = v_release_id;
  end if;

  if v_source_url is not null then
    insert into public.sources (source_type, publisher, url, reliability_tier, captured_at, raw_reference)
    values (v_source_type, v_source_publisher, v_source_url, v_source_tier, now(), 'editor:' || coalesce(v_editor::text, 'unknown'))
    returning id into v_source_id;

    insert into public.release_sources (release_id, source_id, field_coverage, verification_status, editor_notes)
    values (v_release_id, v_source_id, array['release_at', 'retail_price', 'launch_type'], 'verified', v_reason)
    on conflict (release_id, source_id) do nothing;

    update public.releases set last_verified_at = now() where id = v_release_id;
  end if;

  if v_retailer_id is not null then
    insert into public.retailer_launches (release_id, retailer_id, launch_url, launch_at, launch_type, availability_status, last_checked_at)
    values (v_release_id, v_retailer_id, v_retailer_url, v_release_at, v_launch_type, v_status, now())
    on conflict (release_id, retailer_id) do update set
      launch_url = excluded.launch_url,
      launch_at = excluded.launch_at,
      launch_type = excluded.launch_type,
      availability_status = excluded.availability_status,
      last_checked_at = now();
  else
    -- Keep existing retailer launches in step with the release.
    update public.retailer_launches set
      launch_at = v_release_at,
      availability_status = v_status
    where release_id = v_release_id;
  end if;

  if v_target = 'published' then
    v_problem := public.release_publish_problem(v_release_id);
    if v_problem is not null then
      raise exception '%', v_problem using errcode = '22023';
    end if;
    update public.releases set
      editorial_status = 'published',
      published_at = coalesce(published_at, now()),
      last_verified_at = coalesce(last_verified_at, now())
    where id = v_release_id;
  elsif v_before is not null and (v_before ->> 'editorial_status') = 'published' then
    -- Saving a published release as a draft takes it off the public site.
    update public.releases set editorial_status = 'needs_review' where id = v_release_id;
  end if;

  insert into public.editorial_changes (table_name, record_id, editor_id, changed_fields, reason)
  select 'releases', v_release_id, v_editor,
         jsonb_build_object('before', v_before, 'after', to_jsonb(r), 'input', p - 'reason'),
         v_reason
  from public.releases r where r.id = v_release_id;

  return v_release_id;
end;
$$;

-- Quick actions from the release list: publish, unpublish, archive and status changes.
create or replace function public.editor_set_release_state(
  p_release_id uuid,
  p_editorial_status public.editorial_status default null,
  p_status public.release_status default null,
  p_reason text default null
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_before jsonb;
  v_problem text;
begin
  if not public.is_editor() then
    raise exception 'Only editors can manage releases.' using errcode = '42501';
  end if;
  if p_editorial_status is not null and p_editorial_status not in ('needs_review', 'published', 'archived') then
    raise exception 'Unsupported editorial state.' using errcode = '22023';
  end if;
  if p_editorial_status = 'archived' and nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'Give a reason for archiving.' using errcode = '22023';
  end if;

  select to_jsonb(r) into v_before from public.releases r where r.id = p_release_id for update;
  if v_before is null then
    raise exception 'Release not found.' using errcode = 'P0002';
  end if;

  if p_status is not null then
    update public.releases set status = p_status, updated_at = now() where id = p_release_id;
    update public.retailer_launches set availability_status = p_status where release_id = p_release_id;
  end if;

  if p_editorial_status = 'published' or (p_editorial_status is null and (v_before ->> 'editorial_status') = 'published') then
    v_problem := public.release_publish_problem(p_release_id);
    if v_problem is not null then
      raise exception '%', v_problem using errcode = '22023';
    end if;
  end if;

  if p_editorial_status is not null then
    update public.releases set
      editorial_status = p_editorial_status,
      published_at = case when p_editorial_status = 'published' then coalesce(published_at, now()) else published_at end,
      updated_at = now()
    where id = p_release_id;
  end if;

  insert into public.editorial_changes (table_name, record_id, editor_id, changed_fields, reason)
  select 'releases', p_release_id, auth.uid(),
         jsonb_build_object('before', v_before, 'after', to_jsonb(r)),
         nullif(btrim(coalesce(p_reason, '')), '')
  from public.releases r where r.id = p_release_id;
end;
$$;

revoke execute on function public.release_publish_problem(uuid) from public, anon;
revoke execute on function public.editor_save_release(jsonb) from public, anon;
revoke execute on function public.editor_set_release_state(uuid, public.editorial_status, public.release_status, text) from public, anon;
grant execute on function public.release_publish_problem(uuid) to authenticated;
grant execute on function public.editor_save_release(jsonb) to authenticated;
grant execute on function public.editor_set_release_state(uuid, public.editorial_status, public.release_status, text) to authenticated;
-- Editors can read the audit trail for a release from the editor screen.
grant select on table public.editorial_changes to authenticated;
