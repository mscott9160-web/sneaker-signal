-- The 202609120001-0003 seeds published four prototype releases with sample
-- images, guessed brand URLs and Tier 1 "verified" provenance that no editor
-- actually captured. All of their dates have also passed. Production must only
-- publish human-verified records (docs/production-readiness.md), so archive them.
--
-- Archiving keeps the rows and their history; public policies hide them because
-- they only expose editorial_status = 'published'. To restore one deliberately,
-- set editorial_status back to 'published' after re-verifying it.

update public.releases r
set editorial_status = 'archived'
from public.products p
where p.id = r.product_id
  and r.editorial_status = 'published'
  and p.slug in (
    'air-max-95-og-neon',
    'samba-og-wales-bonner-cream',
    '990v6-made-in-usa-vintage-grey',
    'progrid-omni-9-silver-green'
  );

update public.release_sources rs
set verification_status = 'pending',
    editor_notes = 'Prototype seed record; source was never captured by an editor.'
from public.sources s
where s.id = rs.source_id
  and s.raw_reference in (
    'air-max-95-og-neon',
    'samba-og-wales-bonner-cream',
    '990v6-made-in-usa-vintage-grey',
    'progrid-omni-9-silver-green'
  );
