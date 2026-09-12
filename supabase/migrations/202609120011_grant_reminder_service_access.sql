grant select on table public.saved_releases to service_role;
grant select on table public.releases to service_role;
grant select on table public.products to service_role;
grant select on table public.notification_preferences to service_role;
grant select, insert, update on table public.release_reminder_deliveries to service_role;
grant execute on function public.claim_release_reminder_delivery(uuid, uuid, integer, timestamptz, timestamptz) to service_role;
