-- Public catalog seed for the hosted release view. Dates are intentionally
-- future-facing from 2026-09-12 and are editorially approved demo records.

insert into public.products (
  brand_id,
  name,
  slug,
  style_code,
  colorway,
  category,
  sizing_group,
  image_url
)
select
  b.id,
  seed.name,
  seed.slug,
  seed.style_code,
  seed.colorway,
  'lifestyle',
  'unisex',
  seed.image_url
from (
  values
    ('nike', 'Air Max 95 OG', 'air-max-95-og-neon', 'HM0627-001', 'Neon / Black', 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=85'),
    ('adidas', 'Samba OG Wales Bonner', 'samba-og-wales-bonner-cream', 'JH9828', 'Cream White', 'https://images.unsplash.com/photo-1552346154-21d32810aba3?auto=format&fit=crop&w=900&q=85'),
    ('new-balance', '990v6 Made in USA', '990v6-made-in-usa-vintage-grey', 'U990GR6', 'Vintage Grey', 'https://images.unsplash.com/photo-1539185441755-769473a23570?auto=format&fit=crop&w=900&q=85'),
    ('saucony', 'ProGrid Omni 9', 'progrid-omni-9-silver-green', 'S70845-2', 'Silver / Green', 'https://images.unsplash.com/photo-1560769629-975ec94e6a86?auto=format&fit=crop&w=900&q=85')
) as seed(brand_slug, name, slug, style_code, colorway, image_url)
join public.brands b on b.slug = seed.brand_slug
on conflict (slug) do nothing;

insert into public.releases (
  product_id,
  region,
  release_at,
  release_timezone,
  retail_price,
  currency,
  launch_type,
  status,
  editorial_status,
  last_verified_at,
  published_at
)
select
  p.id,
  'US',
  seed.release_at::timestamptz,
  'America/New_York',
  seed.retail_price,
  'USD',
  'online'::public.launch_type,
  'confirmed'::public.release_status,
  'published'::public.editorial_status,
  '2026-09-12 12:00:00+00'::timestamptz,
  '2026-09-12 12:00:00+00'::timestamptz
from (
  values
    ('air-max-95-og-neon', '2026-09-18 10:00:00-04', 185.00),
    ('samba-og-wales-bonner-cream', '2026-09-25 10:00:00-04', 160.00),
    ('990v6-made-in-usa-vintage-grey', '2026-10-03 10:00:00-04', 200.00),
    ('progrid-omni-9-silver-green', '2026-10-10 10:00:00-04', 150.00)
) as seed(product_slug, release_at, retail_price)
join public.products p on p.slug = seed.product_slug
where not exists (
  select 1
  from public.releases existing
  where existing.product_id = p.id
    and existing.region = 'US'
    and existing.release_at = seed.release_at::timestamptz
);