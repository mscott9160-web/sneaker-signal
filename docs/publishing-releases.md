# Publishing a Release

Until the in-app editorial workflow (backlog SS-002) exists, editors publish releases from the
**Supabase Dashboard → SQL Editor** of the production project. The SQL Editor runs as the database
owner, so only people with dashboard access to the project can publish.

Production starts with an **empty catalog**: migration `202611130002` archived the prototype seed
releases because their sources were never captured by an editor. The site shows
"No upcoming releases are published right now" until you publish the first real one.

## Rules before you publish

From `docs/production-readiness.md`:

- Every fact (date, time, price, retailer link) must come from a source you opened yourself.
  Prefer Tier 1 (the brand's own launch page) or Tier 2 (an authorized US retailer).
- Never publish a date, price or link that only came from AI output or a community tip.
- Retailer and source URLs must be `https://`. The site hides anything else.
- Use `status = 'tentative'` when the brand hasn't confirmed the date. Reminder emails are only
  sent for `confirmed` releases.

## Template

Replace every `<...>` value, then run the whole block. It runs in one transaction: if any line
fails, nothing is published.

```sql
begin;

with product as (
  insert into public.products (brand_id, name, slug, style_code, colorway, category, image_url)
  select id, '<Model name>', '<unique-url-slug>', '<STYLE-CODE>', '<Colorway>', 'lifestyle',
         '<https://approved-image-url or null>'
  from public.brands where slug = '<nike | adidas | new-balance | saucony>'
  returning id
),
release as (
  insert into public.releases (product_id, release_at, release_timezone, retail_price,
                               launch_type, status, editorial_status, last_verified_at, published_at)
  select id, '<2026-12-05 10:00>'::timestamp at time zone 'America/New_York', 'America/New_York',
         <190.00>, 'online', 'confirmed', 'published', now(), now()
  from product
  returning id
),
source as (
  insert into public.sources (source_type, publisher, url, reliability_tier, captured_at)
  values ('brand', '<Nike SNKRS>', '<https://official-launch-page>', 1, now())
  returning id
),
linked as (
  insert into public.release_sources (release_id, source_id, field_coverage, verification_status, editor_notes)
  select release.id, source.id, array['release_at', 'retail_price', 'launch_type'], 'verified',
         '<Your name>: checked on the brand launch page'
  from release, source
)
insert into public.retailer_launches (release_id, retailer_id, launch_url, launch_at, launch_type,
                                      availability_status, last_checked_at)
select release.id, r.id, '<https://retailer-product-page>',
       '<2026-12-05 10:00>'::timestamp at time zone 'America/New_York', 'online', 'confirmed', now()
from release, public.retailers r
where r.name = '<Retailer name exactly as in public.retailers>';

commit;
```

Check that it is live by reloading the site while signed out.

## Corrections and withdrawals

- **Date or price changed:** `update public.releases set release_at = ..., last_verified_at = now() where id = '<release id>';`
  and add the new source with a `release_sources` row.
- **Postponed or cancelled:** set `status` to `'postponed'` or `'cancelled'`. Keep the record so
  saved users see what happened.
- **Published by mistake:** `update public.releases set editorial_status = 'archived' where id = '<release id>';`
  This hides it immediately. Don't delete rows; archiving keeps the history.

Find a release id with:

```sql
select r.id, b.name, p.name, r.release_at, r.status, r.editorial_status
from public.releases r join public.products p on p.id = r.product_id join public.brands b on b.id = p.brand_id
order by r.release_at desc limit 20;
```
