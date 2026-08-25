create extension if not exists pgcrypto;

create type public.release_status as enum ('tentative', 'confirmed', 'postponed', 'cancelled', 'restock', 'sold_out', 'expired');
create type public.launch_type as enum ('online', 'in_store', 'raffle', 'draw', 'restock', 'unknown');
create type public.editorial_status as enum ('imported', 'needs_review', 'approved', 'scheduled', 'published', 'rejected', 'archived');
create type public.source_type as enum ('brand', 'retailer', 'licensed_feed', 'editorial', 'community', 'ai_assist');
create type public.price_type as enum ('retail', 'sale', 'resale');

create table public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  official_us_url text,
  supported boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id),
  name text not null,
  slug text not null unique,
  style_code text,
  colorway text,
  category text,
  sizing_group text,
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.releases (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id),
  region text not null default 'US' check (region = 'US'),
  release_at timestamptz,
  release_timezone text not null default 'America/New_York',
  retail_price numeric(10, 2),
  currency text not null default 'USD' check (currency = 'USD'),
  launch_type public.launch_type not null default 'unknown',
  status public.release_status not null default 'tentative',
  editorial_status public.editorial_status not null default 'imported',
  last_verified_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.articles (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references auth.users(id),
  title text not null,
  slug text not null unique,
  excerpt text,
  body text not null,
  category text not null,
  source_url text,
  editorial_status public.editorial_status not null default 'imported',
  published_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.sources (
  id uuid primary key default gen_random_uuid(),
  source_type public.source_type not null,
  publisher text not null,
  url text not null,
  reliability_tier smallint not null check (reliability_tier between 1 and 5),
  captured_at timestamptz not null default now(),
  raw_reference text,
  created_at timestamptz not null default now()
);

create table public.release_sources (
  release_id uuid not null references public.releases(id) on delete cascade,
  source_id uuid not null references public.sources(id) on delete cascade,
  field_coverage text[] not null default '{}',
  verification_status text not null default 'pending',
  editor_notes text,
  created_at timestamptz not null default now(),
  primary key (release_id, source_id)
);

create table public.retailers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  official_us_url text,
  affiliate_partner boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.retailer_launches (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null references public.releases(id) on delete cascade,
  retailer_id uuid not null references public.retailers(id),
  launch_url text not null,
  launch_at timestamptz,
  launch_type public.launch_type not null default 'unknown',
  availability_status public.release_status not null default 'tentative',
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (release_id, retailer_id)
);

create table public.price_observations (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null references public.releases(id) on delete cascade,
  retailer_id uuid references public.retailers(id),
  amount numeric(10, 2) not null,
  currency text not null default 'USD' check (currency = 'USD'),
  observed_at timestamptz not null default now(),
  price_type public.price_type not null default 'retail'
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  is_editor boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.saved_releases (
  user_id uuid not null references auth.users(id) on delete cascade,
  release_id uuid not null references public.releases(id) on delete cascade,
  collection_status text not null default 'saved' check (collection_status in ('saved', 'bought', 'missed', 'passed')),
  created_at timestamptz not null default now(),
  primary key (user_id, release_id)
);

create table public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email_enabled boolean not null default true,
  digest_enabled boolean not null default true,
  restock_enabled boolean not null default false,
  reminder_hours integer[] not null default '{24,1}',
  timezone text not null default 'America/New_York',
  updated_at timestamptz not null default now()
);

create table public.editorial_changes (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  record_id uuid not null,
  editor_id uuid references auth.users(id),
  changed_fields jsonb not null default '{}',
  reason text,
  created_at timestamptz not null default now()
);

create index releases_upcoming_idx on public.releases (release_at, status) where editorial_status = 'published';
create index releases_product_idx on public.releases (product_id);
create index retailer_launches_release_idx on public.retailer_launches (release_id);
create index release_sources_source_idx on public.release_sources (source_id);
create index articles_published_idx on public.articles (published_at desc) where editorial_status = 'published';

alter table public.brands enable row level security;
alter table public.products enable row level security;
alter table public.releases enable row level security;
alter table public.sources enable row level security;
alter table public.release_sources enable row level security;
alter table public.retailers enable row level security;
alter table public.retailer_launches enable row level security;
alter table public.price_observations enable row level security;
alter table public.profiles enable row level security;
alter table public.saved_releases enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.editorial_changes enable row level security;

create or replace function public.is_editor()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_editor = true
  );
$$;

create policy "Public can read supported brands" on public.brands for select using (supported = true);
create policy "Public can read published products" on public.products for select using (exists (
  select 1 from public.releases r where r.product_id = products.id and r.editorial_status = 'published'
));
create policy "Public can read published releases" on public.releases for select using (editorial_status = 'published');
create policy "Public can read release sources" on public.release_sources for select using (exists (
  select 1 from public.releases r where r.id = release_sources.release_id and r.editorial_status = 'published'
));
create policy "Public can read sources for published releases" on public.sources for select using (exists (
  select 1 from public.release_sources rs join public.releases r on r.id = rs.release_id
  where rs.source_id = sources.id and r.editorial_status = 'published'
));
create policy "Public can read retailers" on public.retailers for select using (true);
create policy "Public can read published retailer launches" on public.retailer_launches for select using (exists (
  select 1 from public.releases r where r.id = retailer_launches.release_id and r.editorial_status = 'published'
));
create policy "Public can read published prices" on public.price_observations for select using (exists (
  select 1 from public.releases r where r.id = price_observations.release_id and r.editorial_status = 'published'
));
create policy "Users can read own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Users can manage own saved releases" on public.saved_releases for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can manage own notification preferences" on public.notification_preferences for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Editors can manage catalog" on public.brands for all using (public.is_editor()) with check (public.is_editor());
create policy "Editors can manage products" on public.products for all using (public.is_editor()) with check (public.is_editor());
create policy "Editors can manage releases" on public.releases for all using (public.is_editor()) with check (public.is_editor());
create policy "Editors can manage sources" on public.sources for all using (public.is_editor()) with check (public.is_editor());
create policy "Editors can manage release sources" on public.release_sources for all using (public.is_editor()) with check (public.is_editor());
create policy "Editors can manage retailers" on public.retailers for all using (public.is_editor()) with check (public.is_editor());
create policy "Editors can manage retailer launches" on public.retailer_launches for all using (public.is_editor()) with check (public.is_editor());
create policy "Editors can manage price observations" on public.price_observations for all using (public.is_editor()) with check (public.is_editor());
create policy "Public can read published articles" on public.articles for select using (editorial_status = 'published');
create policy "Editors can manage articles" on public.articles for all using (public.is_editor()) with check (public.is_editor());
create policy "Editors can read editorial changes" on public.editorial_changes for select using (public.is_editor());
create policy "Editors can create editorial changes" on public.editorial_changes for insert with check (public.is_editor());

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id);
  insert into public.notification_preferences (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

insert into public.brands (name, slug, official_us_url) values
  ('Nike', 'nike', 'https://www.nike.com/launch'),
  ('adidas', 'adidas', 'https://www.adidas.com/us/release-dates'),
  ('New Balance', 'new-balance', 'https://www.newbalance.com/launch-calendar/'),
  ('Saucony', 'saucony', 'https://www.saucony.com/en/launch-calendar/')
on conflict (slug) do nothing;
