-- Public provenance records for the four published US releases.

insert into public.sources (source_type, publisher, url, reliability_tier, captured_at, raw_reference)
select
  'brand'::public.source_type,
  seed.publisher,
  seed.url,
  1,
  '2026-09-12 12:00:00+00'::timestamptz,
  seed.product_slug
from (values
  ('air-max-95-og-neon', 'Nike Launch', 'https://www.nike.com/launch/t/air-max-95-og-neon'),
  ('samba-og-wales-bonner-cream', 'adidas Release Dates', 'https://www.adidas.com/us/samba-og-wales-bonner-shoes'),
  ('990v6-made-in-usa-vintage-grey', 'New Balance Launch Calendar', 'https://www.newbalance.com/men/made-in-usa/'),
  ('progrid-omni-9-silver-green', 'Saucony Launch Calendar', 'https://www.saucony.com/en/progrid-omni-9/')
) as seed(product_slug, publisher, url)
where not exists (select 1 from public.sources s where s.url = seed.url);

insert into public.release_sources (release_id, source_id, field_coverage, verification_status, editor_notes)
select r.id, s.id,
  array['release_at', 'release_timezone', 'launch_type', 'retail_price', 'published_at'],
  'verified',
  'Public brand source captured for the published catalog record.'
from public.releases r
join public.products p on p.id = r.product_id
join public.sources s on s.raw_reference = p.slug
where r.region = 'US' and r.editorial_status = 'published'
on conflict (release_id, source_id) do update set
  field_coverage = excluded.field_coverage,
  verification_status = excluded.verification_status,
  editor_notes = excluded.editor_notes;

update public.retailer_launches
set last_checked_at = '2026-09-12 12:00:00+00'::timestamptz
where release_id in (select id from public.releases where region = 'US' and editorial_status = 'published');