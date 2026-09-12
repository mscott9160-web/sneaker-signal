-- Official public retailer links for the four published US releases.

insert into public.retailers (name, official_us_url)
values
  ('Nike', 'https://www.nike.com/launch'),
  ('adidas', 'https://www.adidas.com/us/release-dates'),
  ('New Balance', 'https://www.newbalance.com/men/'),
  ('Saucony', 'https://www.saucony.com/en/collections/launch-calendar/')
on conflict (name) do update
set official_us_url = excluded.official_us_url;

insert into public.retailer_launches (
  release_id,
  retailer_id,
  launch_url,
  launch_at,
  launch_type,
  availability_status
)
select
  r.id,
  retailer.id,
  seed.launch_url,
  r.release_at,
  'online'::public.launch_type,
  r.status
from (
  values
    ('air-max-95-og-neon', 'Nike', 'https://www.nike.com/launch/t/air-max-95-og-neon'),
    ('samba-og-wales-bonner-cream', 'adidas', 'https://www.adidas.com/us/samba-og-wales-bonner-shoes'),
    ('990v6-made-in-usa-vintage-grey', 'New Balance', 'https://www.newbalance.com/men/made-in-usa/'),
    ('progrid-omni-9-silver-green', 'Saucony', 'https://www.saucony.com/en/progrid-omni-9/')
) as seed(product_slug, retailer_name, launch_url)
join public.products p on p.slug = seed.product_slug
join public.releases r on r.product_id = p.id and r.region = 'US' and r.editorial_status = 'published'
join public.retailers retailer on retailer.name = seed.retailer_name
on conflict (release_id, retailer_id) do update
set
  launch_url = excluded.launch_url,
  launch_at = excluded.launch_at,
  launch_type = excluded.launch_type,
  availability_status = excluded.availability_status;