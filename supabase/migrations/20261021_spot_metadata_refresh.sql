-- Scraped public-water metadata (ODWC/USACE) ingested by scripts/scrape/push.ts
-- through the Supabase service role, plus enrichment columns on public.spots.
alter table public.spots
  add column if not exists species text[],
  add column if not exists amenities text[],
  add column if not exists metadata_updated_at timestamptz;

create table if not exists public.spot_metadata (
  id bigint generated always as identity primary key,
  name text not null,
  category text not null,
  waterbody text,
  county text,
  ada boolean not null default false,
  amenities text[] not null default '{}',
  notes text,
  source_url text not null,
  scraped_at timestamptz not null default now(),
  unique (source_url, name)
);

-- Service-role only: RLS on with no policies denies anon/authenticated access.
alter table public.spot_metadata enable row level security;
