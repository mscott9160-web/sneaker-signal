# Launch Checklist

The code is ready for a **free-tier public launch**: live catalog, accounts, saved releases and
notification preferences. The steps below need your accounts and can't be done from the repository.
Do them in order.

Sneaker Signal Plus (Stripe billing) is **not** part of this launch. `docs/production-readiness.md`
allows launching without Plus; add it once the free product shows demand (backlog SS-030 to SS-032).

## 1. Database (Supabase production project)

- [ ] Back up the production database (Dashboard → Database → Backups) before applying migrations.
- [ ] Apply the pending migrations: `npx supabase link --project-ref <ref>` then `npx supabase db push`.
      Two of them matter for launch:
  - `202611130001` fixes a bug where **signed-out visitors could not read the catalog** (they got
    "permission denied for function is_editor", so the site fell back to demo data).
  - `202611130002` archives the four prototype releases. The catalog is empty until step 3.
- [ ] Optional but recommended: run `docs/rls-behavior-test.sql` against a **development** project.
      CI already runs it on plain PostgreSQL on every push.

## 2. Authentication

- [ ] Dashboard → Authentication → URL Configuration: set **Site URL** to your production domain and
      add `https://<your-domain>/**` to **Redirect URLs**. Sign-in links return people to the page they
      signed in from, including `/settings/notifications`.
- [ ] Dashboard → Authentication → SMTP: connect a custom SMTP sender (Resend works). Supabase's
      built-in email is rate limited to a few messages per hour and isn't meant for production.

## 3. Publish real releases

- [ ] Sign in on the site once, then make yourself an editor (SQL in `docs/publishing-releases.md`).
- [ ] Publish at least a few verified upcoming releases from the release desk at `/editor`.
- [ ] Load the site signed out and confirm the banner says **LIVE SUPABASE CATALOG**.

## 4. Hosting (Vercel)

- [ ] Import the repository in Vercel. `vercel.json` already sets the build, page routing for
      `/privacy`, `/terms` and `/settings/notifications`, and security headers.
- [ ] Set environment variables for Production (see `.env.example`):
  - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
  - `VITE_CONTACT_EMAIL`: a monitored inbox. It's shown in the footer and on the policy pages.
  - `VITE_EMAIL_DELIVERY_LIVE=false` until step 6 passes.
- [ ] Add your custom domain.

## 5. Legal review

- [ ] Have `/privacy` and `/terms` reviewed (source: `src/StaticPage.tsx`). They describe what the
      code does today; update them if you add analytics, ads, payments or new providers.
- [ ] If you join affiliate programs, mark those retailers `affiliate_partner = true`. The release
      detail view already shows a commission disclosure next to retailer links.

## 6. Email reminders (can follow after launch)

Follow the dry-run-first runbook in `docs/production-readiness.md` (Production Scheduler Runbook):

- [ ] Verify your sending domain in Resend.
- [ ] Deploy the unsubscribe endpoint: `npx supabase functions deploy unsubscribe --no-verify-jwt`.
      Check it: a `GET` to `https://<ref>.supabase.co/functions/v1/unsubscribe` returns `405`.
- [ ] Deploy `send-release-reminders` with `DRY_RUN=true`, run it by hand, and check the result.
- [ ] Install the hourly scheduler with `docs/reminder-scheduler.sql`.
- [ ] Switch to `DRY_RUN=false`, send one reminder to yourself, then set
      `VITE_EMAIL_DELIVERY_LIVE=true` in Vercel and redeploy.

Every reminder email includes a settings link, an unsubscribe link that works without signing
in (`/unsubscribe?token=…`, one click to confirm), and the `List-Unsubscribe` and
`List-Unsubscribe-Post` headers that Gmail, Yahoo and Apple Mail use for their built-in
Unsubscribe button. Any future email, such as the weekly digest, must reuse `buildReminderEmail`'s
headers and link pattern.

- [ ] After the first live reminder, open it in Gmail and check that the **Unsubscribe** link
      appears next to the sender name, and that using it turns your email settings off.

## 7. Launch-day check

- [ ] Signed out: the catalog loads, the release dialog opens, and retailer links open the right pages.
- [ ] Sign up with a new email, save a release, reload: it's still saved.
- [ ] Change notification settings, reload: they persist. **Turn off all email** works.
- [ ] As an editor: save a draft (not visible signed out), publish it (visible), archive it (gone).
- [ ] `/privacy`, `/terms` and an unknown URL like `/nope` all render.
- [ ] Test on a phone.
