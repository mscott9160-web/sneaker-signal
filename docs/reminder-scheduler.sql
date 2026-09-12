-- Manual production setup for send-release-reminders.
-- Run this in the Supabase SQL Editor only after the Edge Function has been
-- deployed and the Vault secret has been created by an operator.
--
-- Replace only the values marked below. Do not put the secret value in this
-- file or in a migration. The script reads it from Vault at invocation time.

do $$
declare
  project_url constant text := 'https://YOUR_PROJECT_REF.supabase.co';
  function_secret_name constant text := 'sneaker-signal-reminder-function-secret';
  existing_job_id bigint;
begin
  if project_url like '%YOUR_PROJECT_REF%' then
    raise exception 'Set project_url before running the scheduler setup';
  end if;

  if not exists (
    select 1
    from vault.decrypted_secrets
    where name = function_secret_name
  ) then
    raise exception 'Vault secret % does not exist; create it before scheduling', function_secret_name;
  end if;

  select jobid
    into existing_job_id
  from cron.job
  where jobname = 'sneaker-signal-send-release-reminders';

  if existing_job_id is not null then
    raise notice 'Scheduler already exists with job id %; no changes made', existing_job_id;
    return;
  end if;

  perform cron.schedule(
    'sneaker-signal-send-release-reminders',
    '5 * * * *',
    format($job$
      select net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-reminder-secret', (select decrypted_secret from vault.decrypted_secrets where name = %L)
        ),
        body := '{}'::jsonb
      );
    $job$, project_url || '/functions/v1/send-release-reminders', function_secret_name)
  );
end;
$$;
