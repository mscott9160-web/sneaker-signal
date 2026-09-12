# Sneaker Signal Production Readiness

Working checklist for the US MVP. Keep items unchecked until the implementation and its validation are complete.

## Product Scope

- Region: United States
- Audience: Collectors and everyday sneaker buyers
- Initial brands: Nike, adidas, New Balance, Saucony
- Data: Manual curation assisted by AI and approved feeds
- Revenue: Affiliate links and subscriptions
- Notifications: Email first; smartphone app and push notifications later

## Recommended Next Sprint

- [x] 1. Finalize the paid subscription promise.
- [x] 2. Define the release data model and source hierarchy.
- [x] 3. Choose the backend, database, authentication, email, and payment providers.
- [ ] 4. Build the database and protected editorial workflow.
- [ ] 5. Replace hardcoded releases with approved database records.
- [ ] 6. Add release detail pages and official retailer links.
- [ ] 7. Implement persistent saved releases.
- [ ] 8. Add real email signup and reminder delivery.
- [ ] 9. Add automated tests for ingestion, filtering, saving, signup, unsubscribe, and retailer links.

## Paid Subscription Promise

### Product Promise

Sneaker Signal Plus helps US collectors avoid missing relevant releases, restocks, and price opportunities across Nike, adidas, New Balance, and Saucony.

### Free Experience

- Browse verified upcoming releases and sneaker news.
- Search and filter the public catalog.
- View release details, sources, and official retailer links.
- Save a limited number of releases.
- Receive the weekly editorial digest.

### Paid Experience

- Unlimited saved releases and followed brands.
- Custom release reminders by email, including configurable timing.
- Restock and price-change alerts where verified data is available.
- Early access to newly verified release information when editorially appropriate.
- Collector dashboard with upcoming, saved, bought, missed, and passed releases.
- Priority access to advanced filters such as retailer, launch type, price range, and release status.

### Boundary Conditions

- A subscription does not guarantee inventory, successful checkout, authenticity, or access to an exclusive product.
- Alerts only use verified data and clearly label uncertain or changing release information.
- Sponsored content and affiliate recommendations remain disclosed for every user tier.
- Smartphone push notifications are deferred until the web and email workflows show sustained demand.

### Launch Acceptance Criteria

- The free and paid feature boundary is visible before checkout.
- Users can start, manage, cancel, and restore a subscription.
- Billing state is controlled by the payment provider and reconciled through verified webhooks.
- Paid reminder preferences persist across sessions and devices.
- Every paid alert includes a release detail link, source, US timing, and retailer destination when available.
- The team measures trial or checkout conversion, active paid subscribers, alert engagement, cancellations, and failed payments before expanding the paid feature set.

## Release Data Model

### Core Entities

- `Brand`: id, name, slug, supported status, official US URL.
- `Product`: id, brand id, model name, slug, style code/SKU, colorway, category, gender or sizing group, approved image references.
- `Release`: id, product id, US release date/time, timezone, retail price, currency, launch type, status, region, last-verified timestamp, published timestamp.
- `Retailer`: id, name, official URL, US coverage, affiliate partner status.
- `RetailerLaunch`: release id, retailer id, launch URL, launch date/time, launch method, availability status, last-checked timestamp.
- `Source`: id, source type, publisher, URL, reliability tier, captured timestamp, raw reference.
- `ReleaseSource`: release or retailer-launch id, source id, field coverage, verification status, editor notes.
- `PriceObservation`: release id, retailer id, amount, currency, observed timestamp, price type.
- `EditorialChange`: record id, editor, changed fields, previous values, new values, reason, timestamp.

### Required Release Fields

An upcoming release cannot be published without a brand, product name, US region, release status, source reference, and last-verified timestamp. A confirmed launch also requires a release date, retail price, currency, and at least one official brand or retailer destination.

Dates must be stored as timezone-aware timestamps and displayed in the user's local timezone with the US launch timezone included. Prices must remain in USD for the MVP. Records must support tentative dates, postponements, cancellations, restocks, sold-out states, and expiration without deleting history.

### Source Hierarchy

1. **Tier 1: Official brand sources**: Nike, adidas, New Balance, and Saucony launch calendars, product pages, emails, and official social announcements.
2. **Tier 2: Authorized US retailer sources**: approved retailer launch calendars, product pages, raffle pages, and inventory feeds.
3. **Tier 3: Licensed or approved data feeds**: partner feeds with documented freshness, field coverage, and usage rights.
4. **Tier 4: Reputable editorial reporting**: established sneaker publications used for discovery and corroboration, not sole confirmation of commercial details.
5. **Tier 5: AI extraction and community tips**: discovery or drafting inputs only; never sufficient for publication without human verification.

When sources disagree, the higher tier controls factual fields. If two sources in the same tier disagree, the record enters editorial review and is labeled tentative until resolved. Every published release must retain the supporting source and verification history.

### Data Quality Rules

- Deduplicate by brand plus style code/SKU where available, then normalized product and colorway as a fallback.
- Re-verify confirmed releases within 24 hours of launch and tentative releases whenever a new source appears.
- Mark records stale instead of silently presenting old data.
- Never publish AI-generated dates, prices, retailer links, or product claims without human approval.
- Preserve corrections and withdrawn releases in the audit history.

## MVP Provider Decisions

### Supabase: Backend Foundation

Use Supabase for PostgreSQL, database migrations, email authentication, row-level security, object storage, and server-side functions. This keeps the first production system small while providing a durable path for releases, users, editorial review, saved items, and notification preferences.

### Vercel: Web Deployment

Deploy the React web application through Vercel with separate preview and production environments. Production secrets must remain server-side, and deployments must run the build and automated test checks before promotion.

### Resend: Email Delivery

Use Resend for transactional and marketing email during the MVP. Keep transactional release alerts separate from marketing newsletters, record consent and suppression status, and include unsubscribe and preference-management links in every marketing message.

### Stripe: Subscriptions and Billing

Use Stripe Checkout for starting subscriptions and Stripe Customer Portal for billing management. Stripe webhooks are authoritative for subscription status, renewal, cancellation, failed payment, and entitlement changes. Never treat a client-side success screen as proof of payment.

### Provider Boundaries

- The browser calls the application API; provider secrets never ship to the client.
- Supabase Row Level Security protects user-owned saves, preferences, and subscription records.
- Stripe customer and subscription IDs are stored in the database, but Stripe remains the billing system of record.
- Resend delivery events update email status without exposing provider credentials.
- All provider callbacks are signature-verified, idempotent, logged, and safe to replay.
- The deployment environment must define separate development, preview, and production credentials.

### Initial Environment Variables

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SNEAKER_SIGNAL_SERVICE_ROLE_KEY` (server only)
- `RESEND_API_KEY` (server only)
- `STRIPE_SECRET_KEY` (server only)
- `STRIPE_WEBHOOK_SECRET` (server only)
- `STRIPE_PRICE_ID_PLUS`
- `APP_URL`

### Release Reminder Delivery

The `send-release-reminders` Edge Function is service-role-only. It reads saved releases and notification preferences, claims each due `(user, release, reminder_hours)` once in `release_reminder_deliveries`, and sends through Resend. It never returns or exposes the service-role key.

Required server secrets:

- `SNEAKER_SIGNAL_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `REMINDER_FUNCTION_SECRET`
- `APP_URL` (required in production so every reminder includes a preferences/unsubscribe destination)

Local setup and deployment:

```sh
npx supabase db lint
npx supabase db reset
npx supabase secrets set SNEAKER_SIGNAL_SERVICE_ROLE_KEY=... RESEND_API_KEY=... RESEND_FROM_EMAIL=... REMINDER_FUNCTION_SECRET=... APP_URL=https://sneaker-signal.example
npx supabase functions serve send-release-reminders --env-file supabase/.env
npx supabase functions deploy send-release-reminders --no-verify-jwt
```

Invoke it only from a protected scheduler with `POST` and `x-reminder-secret: $REMINDER_FUNCTION_SECRET`. The function does not accept browser authorization headers or CORS requests. In production, missing server or provider secrets fail closed with a generic `503`; a no-send response is available only when `DRY_RUN=true` is explicitly configured. Do not put any of these values in Vite variables, source control, or browser requests.

### Production Scheduler Runbook

Use Supabase `pg_cron` plus `pg_net` only after enabling both extensions in the production project. The scheduler runs hourly at five minutes past the hour (`5 * * * *`), which matches the function's one-hour delivery window while keeping the job to 24 invocations per day. The function's database claim is the duplicate-delivery guard; overlapping invocations are safe because a delivery lease prevents a second claim.

The repository intentionally does not create this job in a migration. A migration cannot safely discover or provision the already-deployed Edge Function secret, and embedding `REMINDER_FUNCTION_SECRET` in SQL would expose it in source control or migration history. Instead, use [docs/reminder-scheduler.sql](reminder-scheduler.sql) after creating a Vault secret named `sneaker-signal-reminder-function-secret`. The script reads `vault.decrypted_secrets` only when `pg_net` executes the request, refuses an unset project URL or missing secret, and leaves an existing job unchanged.

#### Dry-run first

1. Deploy the function with `DRY_RUN=true` and the production server secrets except that no email is sent while this flag is enabled.
2. Create the Vault secret with the exact same random value configured as the function's `REMINDER_FUNCTION_SECRET`. Never paste that value into the SQL file, a migration, browser code, or logs.
3. Invoke the deployed function manually with `POST`, `Content-Type: application/json`, and `x-reminder-secret`. Confirm a `200` response containing `"dry_run":true`, and confirm `sent` is `0`.
4. Run [docs/reminder-scheduler.sql](reminder-scheduler.sql) once in the production SQL Editor. Confirm the job exists in Dashboard -> Integrations -> Cron and inspect `net._http_response` or the function logs after the next hourly run.
5. Set `DRY_RUN=false` (or remove it) only after the dry-run response, function logs, candidate data, and provider configuration are verified. Invoke once manually and confirm the expected delivery and `release_reminder_deliveries` state before relying on the hourly job.

The scheduler sends only `Content-Type: application/json` and the protected `x-reminder-secret` header. It does not send a service-role key or browser `Authorization` header. Keep the function deployed with `--no-verify-jwt`; the function's dedicated secret is its invocation control. Treat the Vault secret and the function environment value as one credential pair and rotate both together.

To disable delivery immediately, disable or unschedule `sneaker-signal-send-release-reminders` in Dashboard -> Integrations -> Cron, or run `select cron.unschedule('sneaker-signal-send-release-reminders');`. To revoke invocation access, rotate or remove `REMINDER_FUNCTION_SECRET` from the Edge Function, then rotate or remove the matching Vault secret with `select vault.delete_secret('<vault-secret-id>');` after looking up its id by name. Do not delete a secret by guessing its id. Re-enable only after a new pair has been configured and the dry-run procedure has passed again. Existing in-flight HTTP requests may finish; disabling the cron job prevents future invocations.

Reminders require a saved release with `editorial_status = 'published'`, `status = 'confirmed'`, a valid future `release_at`, enabled email preferences, and a selected positive reminder hour. Postponed, cancelled, sold-out, and expired releases are excluded. Invalid preference timezones fall back to the release timezone, then UTC. Production sends fail closed without `APP_URL`; the email includes `/settings/notifications` as the preferences/unsubscribe destination.

The delivery table uses a unique key, database claim function, lease timestamps, retry timestamps, and bounded attempt counts. Network and transient provider failures are retried with capped exponential backoff; exhausted or permanent failures become `dead_letter`. A lease is always cleared after a fetch or provider response so an exception cannot strand the row. Resend acknowledgement and the database update cannot be atomic: a provider may accept a message before the function loses its response, so a later retry can duplicate it. Configure and use a provider-supported idempotency key when Resend exposes one, and monitor dead-letter rows.

## Additional Implementation To-Dos

- [ ] Create development and production Supabase projects.
- [ ] Run the initial migration in development and verify all tables, indexes, triggers, and RLS policies.
- [ ] Replace the editor boolean with an explicit role model before inviting additional staff.
- [ ] Add protected editor policies for creating, reviewing, publishing, archiving, and correcting releases and articles.
- [ ] Add article records with author, category, source, publication status, published timestamp, and correction history.
- [ ] Add a seed-data review step so no demo dates, placeholder profiles, or unverified image URLs reach production.
- [ ] Add a migration smoke test that runs against an isolated database on every pull request.
- [ ] Document the backup, restore, and migration rollback procedure.
- [ ] Add an operational runbook for stale sources, conflicting dates, broken retailer links, and emergency unpublishing.

## Known Blockers

### Local Supabase Requires Docker

**Status:** Blocked on local machine setup as of 2026-08-16.

Docker Desktop is installed and the Docker CLI is available at `C:\Program Files\Docker\Docker\resources\bin\docker.exe`, but Docker Desktop cannot start because Windows Subsystem for Linux (WSL) is not installed. `npx supabase db lint` consequently cannot connect to the local Postgres container at `127.0.0.1:54322`.

**Observed errors:**

- `wsl.exe`: Windows Subsystem for Linux is not installed
- `Docker Desktop is unable to start`
- `failed to connect to postgres ... ECONNREFUSED 127.0.0.1:54322`

**Resolution checklist:**

- [x] Install Docker Desktop for Windows.
- [x] Install WSL 2 from an elevated PowerShell: `wsl --install --no-distribution`.
- [ ] Restart Windows so WSL 2 and Virtual Machine Platform changes take effect.
- [ ] Open Docker Desktop and complete its first-run setup or terms prompt.
- [ ] Confirm `wsl --status` reports a working default version and `docker info` reaches the engine.
- [ ] If Docker still cannot start, enable `Microsoft-Windows-Subsystem-Linux` and `VirtualMachinePlatform` from Windows Features, then restart.
- [ ] If WSL still reports virtualization unavailable, have an administrator run `bcdedit /set hypervisorlaunchtype auto` and restart.
- [ ] If the issue persists, verify virtualization/Intel VT-x/AMD-V is enabled in UEFI/BIOS and confirm no corporate policy disables Hyper-V or nested virtualization.
- [ ] Confirm `docker --version` works in a new terminal.
- [ ] Run `npx supabase start` from the project root.
- [ ] Run `npx supabase db lint` and resolve any SQL errors.
- [ ] Run `npx supabase db reset` against the local instance to apply the migration from scratch.
- [ ] Re-run the migration smoke test before checking off the database workflow item.

The Docker Desktop package is available through `winget` as `Docker.DockerDesktop`. Installation may require Windows administrator approval and a system restart, so it must be completed outside this agent session if elevation is requested.

**Current transition state:** WSL 2.7.11 and Virtual Machine Platform installed successfully on 2026-08-16. On the latest check, `systeminfo` reports firmware virtualization enabled and the required CPU capabilities present, but `wsl --status` still reports virtualization unavailable. Docker Desktop reports that virtualization support was not detected, and `docker info` reaches the client but returns a 500 error from the Linux engine. This indicates a pending reboot, disabled hypervisor launch configuration, incomplete Windows optional-feature activation, or BIOS/IT policy enforcement. Do not rerun Supabase validation until WSL starts successfully and `docker info` returns a healthy Server section.

## Completion Rule

Check an item only after the implementation is complete and the relevant validation has passed. Update this checklist as each item is finished, then review the remaining production-readiness blockers before moving to the next phase.
