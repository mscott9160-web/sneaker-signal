create table public.release_reminder_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  release_id uuid not null references public.releases(id) on delete cascade,
  reminder_hours integer not null check (reminder_hours > 0),
  scheduled_for timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  provider_id text,
  error_message text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (user_id, release_id, reminder_hours)
);

create index release_reminder_deliveries_pending_idx
  on public.release_reminder_deliveries (scheduled_for, status)
  where status in ('pending', 'failed');

create index release_reminder_deliveries_user_idx
  on public.release_reminder_deliveries (user_id, created_at desc);

alter table public.release_reminder_deliveries enable row level security;

revoke all on table public.release_reminder_deliveries from anon, authenticated;
grant all on table public.release_reminder_deliveries to service_role;
