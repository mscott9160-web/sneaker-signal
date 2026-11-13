-- 202609120010 revoked EXECUTE on public.is_editor() from anon, but the editor
-- policies were created without a role list, so they also apply to anon. Postgres
-- evaluates every permissive policy for a command, so an anonymous SELECT on
-- releases, products, brands, sources, etc. failed with
-- "permission denied for function is_editor" and the public catalog could not load.
--
-- Editors are always signed in, so these policies only need the authenticated role.

alter policy "Editors can manage catalog" on public.brands to authenticated;
alter policy "Editors can manage products" on public.products to authenticated;
alter policy "Editors can manage releases" on public.releases to authenticated;
alter policy "Editors can manage sources" on public.sources to authenticated;
alter policy "Editors can manage release sources" on public.release_sources to authenticated;
alter policy "Editors can manage retailers" on public.retailers to authenticated;
alter policy "Editors can manage retailer launches" on public.retailer_launches to authenticated;
alter policy "Editors can manage price observations" on public.price_observations to authenticated;
alter policy "Editors can manage articles" on public.articles to authenticated;
alter policy "Editors can read editorial changes" on public.editorial_changes to authenticated;
alter policy "Editors can create editorial changes" on public.editorial_changes to authenticated;
