# Sneaker Signal

US sneaker release intelligence for collectors and everyday buyers.

Sneaker Signal tracks verified releases, launch details, and sneaker culture across Nike, adidas, New Balance, and Saucony. The current web app is the product prototype and is being developed toward a production MVP with Supabase-backed data, email alerts, and affiliate retailer links.

## MVP Scope

- Region: United States
- Currency: USD
- Audience: Collectors and everyday buyers
- Data: Manual curation assisted by AI and approved feeds
- Notifications: Email first; smartphone push later
- Revenue: Affiliate links and subscriptions

## Local Development

```powershell
npm install
npm run dev
```

Validate the app before opening a pull request:

```powershell
npm run lint
npm run build
```

## Supabase

The schema lives in `supabase/migrations`. The hosted development project uses the reference `kisdyclkdzttmlsyxvbt`.

After authenticating with the Supabase CLI:

```powershell
npx supabase link --project-ref kisdyclkdzttmlsyxvbt
npx supabase db push
```

Never commit `.env` files, provider secrets, database passwords, service-role keys, or access tokens.

## Production Readiness

The tracked implementation checklist is in [docs/production-readiness.md](docs/production-readiness.md). It covers the paid subscription promise, release data model, provider decisions, editorial workflow, persistence, email alerts, and automated testing.
