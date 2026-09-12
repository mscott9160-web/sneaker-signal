alter table public.release_reminder_deliveries
  add column max_attempts integer not null default 3 check (max_attempts between 1 and 10),
  add column next_attempt_at timestamptz,
  drop constraint release_reminder_deliveries_status_check,
  add constraint release_reminder_deliveries_status_check check (status in ('pending', 'sent', 'failed', 'dead_letter'));

create index release_reminder_deliveries_retry_idx
  on public.release_reminder_deliveries (next_attempt_at, status)
  where status = 'pending';

drop function public.claim_release_reminder_delivery(uuid, uuid, integer, timestamptz, timestamptz);

create or replace function public.claim_release_reminder_delivery(
  p_user_id uuid, p_release_id uuid, p_reminder_hours integer, p_scheduled_for timestamptz,
  p_lease_until timestamptz
)
returns table (id uuid, attempt_count integer, max_attempts integer)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  insert into public.release_reminder_deliveries (user_id, release_id, reminder_hours, scheduled_for, status, claimed_at, lease_until, attempt_count)
  values (p_user_id, p_release_id, p_reminder_hours, p_scheduled_for, 'pending', now(), p_lease_until, 1)
  on conflict (user_id, release_id, reminder_hours) do update
    set status = 'pending', claimed_at = now(), lease_until = p_lease_until,
        scheduled_for = excluded.scheduled_for, next_attempt_at = null,
        attempt_count = public.release_reminder_deliveries.attempt_count + 1,
        error_message = null
    where public.release_reminder_deliveries.status not in ('sent', 'dead_letter')
      and public.release_reminder_deliveries.attempt_count < public.release_reminder_deliveries.max_attempts
      and (public.release_reminder_deliveries.lease_until is null or public.release_reminder_deliveries.lease_until < now())
      and (public.release_reminder_deliveries.next_attempt_at is null or public.release_reminder_deliveries.next_attempt_at <= now())
  returning release_reminder_deliveries.id, release_reminder_deliveries.attempt_count, release_reminder_deliveries.max_attempts;
end;
$$;

revoke all on function public.claim_release_reminder_delivery(uuid, uuid, integer, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.claim_release_reminder_delivery(uuid, uuid, integer, timestamptz, timestamptz) to service_role;