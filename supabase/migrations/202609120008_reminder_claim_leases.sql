alter table public.release_reminder_deliveries
  add column attempt_count integer not null default 0 check (attempt_count >= 0),
  add column claimed_at timestamptz,
  add column lease_until timestamptz;

create or replace function public.claim_release_reminder_delivery(
  p_user_id uuid, p_release_id uuid, p_reminder_hours integer, p_scheduled_for timestamptz,
  p_lease_until timestamptz
)
returns table (id uuid)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  insert into public.release_reminder_deliveries (user_id, release_id, reminder_hours, scheduled_for, status, claimed_at, lease_until, attempt_count)
  values (p_user_id, p_release_id, p_reminder_hours, p_scheduled_for, 'pending', now(), p_lease_until, 1)
  on conflict (user_id, release_id, reminder_hours) do update
    set status = 'pending', claimed_at = now(), lease_until = excluded.lease_until,
        scheduled_for = excluded.scheduled_for,
        attempt_count = public.release_reminder_deliveries.attempt_count + 1,
        error_message = null
    where public.release_reminder_deliveries.status <> 'sent'
      and (public.release_reminder_deliveries.lease_until is null or public.release_reminder_deliveries.lease_until < now())
  returning release_reminder_deliveries.id;
end;
$$;

revoke all on function public.claim_release_reminder_delivery(uuid, uuid, integer, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.claim_release_reminder_delivery(uuid, uuid, integer, timestamptz, timestamptz) to service_role;