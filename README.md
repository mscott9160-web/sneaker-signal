# Sneaker Signal

> US sneaker release intelligence for collectors and everyday buyers.

Sneaker Signal is a product prototype for tracking verified sneaker releases, launch details, retailer availability, and the stories around the pairs people care about. It is being developed toward a production MVP with a Supabase-backed catalog, email alerts, and disclosed affiliate retailer links.

This project demonstrates product thinking as well as implementation: the repository includes the customer-facing React experience, a relational release model, source verification rules, row-level security policies, and a production-readiness plan.

## Why it exists

Sneaker release information is scattered across brand calendars, retailer pages, raffles, and editorial coverage. Sneaker Signal brings that information into one focused US catalog and makes confidence and source quality part of the product experience.

## Current experience

- Browse upcoming releases across Nike, adidas, New Balance, and Saucony
- Search the catalog and filter saved releases
- Surface release dates, retail prices, colorways, and launch status
- Browse editorial sneaker culture content
- Define a path to reminders, saved collections, and a paid subscription tier

## Technical highlights

- React 19 and TypeScript with Vite
- Supabase PostgreSQL schema and migrations
- Row-level security for user-owned saves, preferences, and editorial access
- Source hierarchy and verification states for release data quality
- Production-readiness documentation covering providers, billing boundaries, and operational risks
- Oxlint plus TypeScript/Vite production builds

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

The schema lives in `supabase/migrations`. Configure the hosted development project with your own Supabase project reference.

After authenticating with the Supabase CLI:

```powershell
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

Never commit `.env` files, provider secrets, database passwords, service-role keys, or access tokens.

## Production Readiness

The tracked implementation checklist is in [docs/production-readiness.md](docs/production-readiness.md). It covers the paid subscription promise, release data model, provider decisions, editorial workflow, persistence, email alerts, and automated testing.

## Project status

The current branch is a production-oriented foundation and product prototype. The remaining work is tracked openly in [the production-readiness checklist](docs/production-readiness.md), including replacing hardcoded demo releases with approved database records, adding protected editorial workflows, implementing persistent saves and email delivery, and adding automated tests.

## Portfolio context

Built by [Myles B. Scott](https://github.com/mscott9160-web) as an example of end-to-end product development: translating a domain problem into a usable interface, a durable data model, explicit trust rules, and a measurable path to production.
