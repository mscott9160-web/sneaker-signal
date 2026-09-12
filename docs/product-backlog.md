# Sneaker Signal Product Backlog

**As of:** 2026-09-12  
**MVP:** US sneaker release intelligence for collectors and everyday buyers  
**Delivery posture:** Production-oriented prototype; dry-run reminder path is defined, but live email and full production MVP are not ready.

## Current Status

| Area | Status | Evidence / remaining work |
|---|---|---|
| Product scope and paid promise | Ready for implementation | US/USD scope, free/Plus boundary, affiliate disclosure, and push deferral are defined in `docs/production-readiness.md`. |
| Release model and trust rules | Foundation complete | Release, retailer, source, verification, audit, price, and timezone requirements are documented and represented in Supabase migrations. |
| Catalog UI | Prototype | React/Vite experience supports browsing, search, filters, saved-mode behavior, date/time formatting, status labels, and demo provenance. Replace demo fallback with approved live records. |
| Live catalog read path | Partial | Supabase client mapping and live-row tests exist; live environment, published data, and end-to-end read validation still need proof. |
| Editorial workflow | Not ready | Protected role model, create/review/publish/correct/archive flows, article records, and audit workflow remain open. |
| Saved releases and preferences | Contract only | Database access grants and TypeScript contracts exist; authenticated UI persistence and end-to-end RLS validation remain open. |
| Reminder function | Implementation present | Secret-gated Edge Function, eligibility policy, claims, retries, dead-letter handling, and `DRY_RUN` behavior are present. Deployment and integration evidence are still required. |
| Email production | Not ready | Resend configuration, sender/domain verification, scheduler, provider events, unsubscribe behavior, and live delivery evidence are outstanding. |
| Billing / Plus | Not started | Stripe Checkout, Customer Portal, webhook reconciliation, entitlement state, and paid acceptance checks remain open. |
| Automated quality | Partial | Focused Vitest coverage exists for release mapping/model/client contracts. Migration, function, RLS, ingestion, save, email, unsubscribe, and retailer-link tests remain. |

## Completed Milestones

- [x] Product scope, audience, US region, USD currency, and MVP boundaries defined.
- [x] Free versus paid subscription promise and non-guarantees documented.
- [x] Supabase, Vercel, Resend, and Stripe provider direction selected with secret boundaries.
- [x] Release data model, required fields, source hierarchy, verification rules, stale-data rules, and audit expectations defined.
- [x] Initial Supabase schema and follow-on catalog, access, notification, delivery, claim-lease, and retry migrations added.
- [x] Catalog adapter maps live rows, nested products, retailers, sources, provenance, dates, prices, and nullable fields.
- [x] Client-side release filtering, verified-status rules, timezone formatting, and HTTPS retailer URL validation covered by tests.
- [x] Reminder function includes method and shared-secret protection, dry-run mode, release eligibility checks, duplicate-claim protection, retry bounds, and dead-letter handling.
- [x] Production scheduler SQL and a documented dry-run-to-live runbook added.

## Prioritized Epics and User Stories

### Epic 1: Establish a validated data foundation (P0)

**Owner roles:** Tech Lead, Backend Dev, QA Tester, Business Partner

| ID | User story | Acceptance criteria | Dependencies |
|---|---|---|---|
| SS-001 | As an operator, I can run the schema from a clean database. | Development Supabase project exists; migrations apply from zero; `db lint`, reset, indexes, triggers, grants, and RLS checks pass; rollback/backup procedure is documented. | Docker/WSL or hosted development project; migration set. |
| SS-002 | As an editor, I can manage release records through protected workflow states. | Explicit editor roles replace the boolean; create, review, publish, correct, archive, and unpublish actions are authorization-tested; audit history preserves changed fields and reasons. | SS-001. |
| SS-003 | As a buyer, I see only approved, current release data. | Published rows require required fields and source/verification timestamps; tentative, postponed, cancelled, sold-out, stale, and expired states render correctly; no AI-only commercial claim is publishable. | SS-002; approved seed/import process. |
| SS-004 | As a buyer, I can inspect official retailer destinations. | Release detail shows source and retailer metadata; only safe HTTPS URLs render; broken, non-US, or unapproved destinations are rejected or flagged. | SS-003; retailer approval list. |

### Epic 2: Ship the authenticated catalog workflow (P0)

**Owner roles:** Frontend Dev, Backend Dev, QA Tester

| ID | User story | Acceptance criteria | Dependencies |
|---|---|---|---|
| SS-010 | As a visitor, I can browse a live catalog instead of demo-only data. | Configured live Supabase data loads in the UI; loading, empty, unavailable, and error states are explicit; demo fallback is never mistaken for live data. | SS-001, SS-003. |
| SS-011 | As a buyer, I can open a release detail view. | Detail view includes release time plus US timezone, price/currency, status, verification timestamp, sources, retailer launches, and disclosure where applicable. | SS-004, SS-010. |
| SS-012 | As a signed-in buyer, I can save and classify releases. | Save, unsave, and `saved/bought/missed/passed` status persist across sessions; unauthenticated users receive a clear sign-in path; RLS prevents cross-user access. | SS-001; auth configuration. |
| SS-013 | As a signed-in buyer, I can manage notification preferences. | Email, digest, restock, timezone, and positive reminder-hour settings persist; invalid values are rejected; preferences are user-scoped and have a usable unsubscribe path. | SS-012. |

### Epic 3: Prove reminder delivery safely (P0)

**Owner roles:** Backend Dev, QA Tester, Tech Lead, Scrum Master

| ID | User story | Acceptance criteria | Dependencies |
|---|---|---|---|
| SS-020 | As an operator, I can invoke reminders in dry-run mode. | Deployed function accepts only POST plus the dedicated secret; `DRY_RUN=true` returns `200` with `dry_run:true`, `sent:0`; candidate selection, skips, auth failures, missing secrets, and logs are verified without sending mail. | SS-001, SS-013; Supabase project; function secrets. |
| SS-021 | As an operator, I can schedule reminder checks without exposing secrets. | Vault secret and function secret match; scheduler is created from `docs/reminder-scheduler.sql`; hourly job invokes the function with JSON and `x-reminder-secret`; no service-role or browser auth header is used. | SS-020; `pg_cron` and `pg_net`; hosted project. |
| SS-022 | As a buyer, I receive one correct reminder for an eligible release. | With `DRY_RUN=false`, a controlled test recipient receives expected content with release detail and preferences destination; delivery row is claimed once and marked sent; duplicate invocation does not duplicate the claim. | SS-020, SS-021; verified Resend sender/domain. |
| SS-023 | As an operator, I can recover from delivery failures. | Network/transient failures retry with bounded backoff; permanent failures and exhausted retries become dead-letter; leases clear; dashboards/logs identify failures; disable/rotate runbook is exercised. | SS-022; provider event/error access. |

### Epic 4: Launch the paid product boundary (P1)

**Owner roles:** Business Partner, Backend Dev, Frontend Dev, Tech Lead

| ID | User story | Acceptance criteria | Dependencies |
|---|---|---|---|
| SS-030 | As a visitor, I understand free versus Plus before checkout. | Feature boundary, limitations, affiliate disclosure, and no-inventory/no-authenticity guarantee are visible before payment. | SS-012, SS-013. |
| SS-031 | As a subscriber, I can start, manage, cancel, and restore Plus. | Stripe Checkout and Customer Portal work; Stripe webhooks are signature-verified, idempotent, replay-safe, and authoritative for entitlement, renewal, cancellation, and failed payment. | SS-001; Stripe account and price. |
| SS-032 | As a Plus subscriber, I receive the promised entitlements. | Unlimited saves, followed brands, configurable reminders, and eligible advanced filters are enforced server-side; paid preferences persist across devices; entitlement loss removes paid access predictably. | SS-031, SS-022. |

### Epic 5: Operate trustworthy content and measure the MVP (P1)

**Owner roles:** Business Partner, Backend Dev, QA Tester, Early Consumer

| ID | User story | Acceptance criteria | Dependencies |
|---|---|---|---|
| SS-040 | As an editor, I can publish source-backed editorial content. | Article records include author, category, source, publication state, timestamp, and correction history; protected access and disclosure rules are tested. | SS-002. |
| SS-041 | As the team, we can detect data and retailer failures. | Runbook covers stale/conflicting sources, broken links, withdrawn releases, emergency unpublishing, provider incidents, and dead letters; alert ownership and response targets are named. | SS-003, SS-004, SS-023. |
| SS-042 | As a product team, we can evaluate launch health. | Metrics cover catalog freshness, verification conflicts, signup, checkout conversion, active subscribers, alert engagement, cancellations, failed payments, delivery failures, and unsubscribe rate. | SS-022, SS-031; analytics instrumentation. |

## Sprint Order

| Sprint | Objective | Stories | Exit condition |
|---|---|---|---|
| Sprint 0 | Unblock environments and establish CI evidence | SS-001 foundation tasks | Development Supabase is usable, migrations are validated, and `npm run lint`, `npm test`, and `npm run build` pass in CI. |
| Sprint 1 | Make the catalog editorially safe and live | SS-002, SS-003, SS-004, SS-010, SS-011 | A reviewer can publish a verified release and a visitor can inspect its detail and official retailer destination. |
| Sprint 2 | Deliver authenticated saves and preferences | SS-012, SS-013 | RLS-backed save and preference flows pass end-to-end tests for signed-in and signed-out users. |
| Sprint 3 | Prove reminder operations without email risk | SS-020, SS-021 | Dry-run function and scheduler pass the dry-run gate with no email sent and observable candidate/skip behavior. |
| Sprint 4 | Enable controlled live email | SS-022, SS-023 | One controlled live delivery, duplicate protection, retries, dead-letter handling, unsubscribe destination, and rollback procedure pass the live-email gate. |
| Sprint 5 | Monetize and measure | SS-030, SS-031, SS-032, SS-042 | Stripe webhook-driven entitlements, customer self-service, metrics, and paid acceptance tests pass. |
| Sprint 6 | Harden editorial operations | SS-040, SS-041 | Content corrections, emergency unpublishing, incident ownership, and operational drills pass. |

## Release Gates

### Gate A: Code and migration readiness

- `npm run lint`, `npm test`, and `npm run build` pass.
- `npx supabase db lint` and a clean `npx supabase db reset` pass in an available isolated environment.
- Migration smoke tests cover schema, constraints, indexes, triggers, grants, RLS, reminder claim leases, and retry bounds.
- No secrets, `.env` files, service-role keys, or provider credentials are committed.

### Gate B: Dry-run reminder readiness (no email)

- Development or production-like Supabase project has the required server secrets except live sending is prevented with `DRY_RUN=true`.
- Function rejects wrong method, missing secret, and wrong secret; browser authorization/CORS paths are not accepted.
- A controlled candidate set proves eligible, ineligible, missing-preference, invalid-timezone, and due/not-due behavior.
- Manual POST returns `200`, `dry_run:true`, and `sent:0`; logs contain no secrets or recipient content that is not needed for diagnosis.
- Scheduler SQL is installed only after manual dry-run success; the next invocation is observed in Cron and function logs.

**Dry-run ready means the selection, authorization, scheduler wiring, and no-send behavior are demonstrated. It does not mean email delivery, sender reputation, unsubscribe compliance, or production operations are ready.**

### Gate C: Live-email production readiness

- Gate B passes and `DRY_RUN=false` is approved by the Tech Lead and QA Tester.
- Resend sender/domain is verified; transactional and marketing streams are separated; suppression and unsubscribe behavior are tested.
- `APP_URL`, sender, provider key, service-role key, and function secret are configured server-side; matching Vault/function secrets are verified without exposing values.
- One controlled recipient receives the expected message with release detail and preference-management destination.
- Claim uniqueness, replay behavior, retry/backoff, lease cleanup, permanent failure, dead-letter, and provider response handling are observed in the database/logs.
- Kill switch, secret rotation, scheduler disablement, and re-enable-after-dry-run procedures are tested.
- Production owner, alert destination, backup/restore path, and incident response are documented.

**Live-email ready means a controlled delivery and its failure paths are proven in the production configuration. It does not authorize paid launch until billing and entitlement gates also pass.**

### Gate D: MVP launch readiness

- Live catalog and editorial workflow are approved; all public commercial facts have current source evidence.
- Authenticated saves, notification preferences, and RLS tests pass.
- Live-email Gate C passes with monitoring in place.
- Free/Plus boundary, Stripe webhooks, cancellation/restore, and entitlement reconciliation pass if Plus is enabled at launch.
- Accessibility, responsive UI, retailer-link safety, privacy/consent, disclosures, analytics, and rollback checks pass.
- Product owner signs off on known risks and the first-week operating cadence.

## Explicit Blockers

1. **Local Supabase validation is blocked by the Windows Docker/WSL state.** The documented state says WSL/Virtual Machine Platform changes require restart and Docker’s Linux engine is not healthy. Until `wsl --status` and `docker info` show a working engine, local `db lint`, reset, and migration smoke tests cannot be treated as passed.
2. **No proven protected editorial workflow.** The current implementation still needs explicit editor roles and authorization-tested publish/correct/archive paths before live data can be trusted.
3. **The UI can still fall back to demo releases.** Live catalog configuration, approved seed data, and an end-to-end live read check are required before production catalog claims.
4. **Authenticated save and preference workflows are not end-to-end proven.** Contracts and grants exist, but browser flows, RLS isolation, and persistence across sessions/devices remain open.
5. **Reminder deployment and scheduler evidence are not complete.** The function and SQL exist, but dry-run invocation, Cron observation, and controlled candidate verification must be recorded.
6. **Live email provider readiness is unproven.** Sender/domain verification, suppression/unsubscribe checks, live controlled delivery, and incident controls remain outstanding.
7. **Billing is unimplemented.** Stripe integration and webhook-authoritative entitlement reconciliation are required before Plus can be sold.
8. **Operational and migration controls are incomplete.** Backup/restore, rollback, monitoring, stale-source handling, broken-link handling, and emergency unpublishing need runbooks and drills.

## Next Recommended Implementation Slice

**Slice: unblock and prove the database/editorial foundation (SS-001 + the smallest SS-002 path).**

1. Restart Windows and verify WSL 2 and Docker Desktop health; if local infrastructure remains unavailable, provision a dedicated Supabase development project for validation.
2. Run migration lint/reset from a clean environment and fix only schema, grant, RLS, or claim-lease defects found by that check.
3. Replace the editor boolean with the smallest explicit role model needed for one protected editor account.
4. Add one end-to-end protected workflow: create or seed a release, attach a Tier 1 source, review it, publish it, and record the audit change.
5. Add a migration smoke test and a live catalog read test proving the UI labels data as `live`, while preserving the existing demo fallback for unavailable environments.
6. Re-run `npm run lint`, `npm test`, `npm run build`, database validation, and the publish/read acceptance checks.

**Why this slice first:** it removes the highest-risk dependency shared by catalog trust, release detail pages, saved reminders, and later billing. Do not enable live email until this slice and Gate B are evidenced.
