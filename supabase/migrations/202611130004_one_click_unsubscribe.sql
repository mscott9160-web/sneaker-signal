-- One-click unsubscribe without signing in.
--
-- Every preferences row gets a random token (122 bits of randomness, not guessable).
-- Emails carry it in an /unsubscribe link and in the RFC 8058 List-Unsubscribe header.
-- public.unsubscribe_by_token() turns off every email for the matching user and
-- records when it happened, which is the evidence an opt-out was honoured.

alter table public.notification_preferences
  add column unsubscribe_token uuid not null default gen_random_uuid(),
  add column unsubscribed_at timestamptz;

create unique index notification_preferences_unsubscribe_token_key
  on public.notification_preferences (unsubscribe_token);

create or replace function public.unsubscribe_by_token(p_token uuid)
returns boolean
language plpgsql
security definer set search_path = public
as $$
begin
  if p_token is null then
    return false;
  end if;

  update public.notification_preferences
  set email_enabled = false,
      digest_enabled = false,
      restock_enabled = false,
      unsubscribed_at = coalesce(unsubscribed_at, now()),
      updated_at = now()
  where unsubscribe_token = p_token;

  return found;
end;
$$;

-- Signed-out visitors (the /unsubscribe page) and the unsubscribe Edge Function call this.
revoke execute on function public.unsubscribe_by_token(uuid) from public;
grant execute on function public.unsubscribe_by_token(uuid) to anon, authenticated, service_role;

-- Turning email back on in settings clears the opt-out marker.
create or replace function public.clear_unsubscribed_at()
returns trigger
language plpgsql
as $$
begin
  if new.email_enabled or new.digest_enabled or new.restock_enabled then
    new.unsubscribed_at := null;
  end if;
  return new;
end;
$$;

create trigger notification_preferences_clear_unsubscribed_at
before update on public.notification_preferences
for each row
when (new.unsubscribed_at is not null)
execute function public.clear_unsubscribed_at();

-- Users edit their own preferences, but never the token or the opt-out evidence.
revoke insert, update on table public.notification_preferences from authenticated;
grant insert (user_id, email_enabled, digest_enabled, restock_enabled, reminder_hours, timezone)
  on table public.notification_preferences to authenticated;
grant update (user_id, email_enabled, digest_enabled, restock_enabled, reminder_hours, timezone, updated_at)
  on table public.notification_preferences to authenticated;
