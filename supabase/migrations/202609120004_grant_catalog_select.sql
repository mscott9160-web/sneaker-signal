alter table public.articles enable row level security;

grant select on table
  public.brands,
  public.products,
  public.releases,
  public.release_sources,
  public.sources,
  public.retailers,
  public.retailer_launches,
  public.price_observations,
  public.articles
to anon, authenticated;