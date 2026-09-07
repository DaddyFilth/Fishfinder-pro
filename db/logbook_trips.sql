-- ============================================================
-- FishFinder Pro — Logbook Trip Journal (additive schema)
-- Applies on top of db/supabase-schema.sql
-- Run in the Supabase SQL editor. Safe to re-run.
-- ============================================================

-- Trips: one row per logged fishing trip.
create table if not exists public.logbook_trips (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  title          text not null check (char_length(title) <= 120),
  water_body     text,
  trip_date      date not null default current_date,
  weather        text,
  species        text,
  catches_count  integer not null default 0 check (catches_count >= 0),
  notes          text,
  latitude       double precision,
  longitude      double precision,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table public.logbook_trips is 'Fishing trip journal entries for the Logbook tab.';

-- Photos: one row per photo attached to a trip.
-- storage_path points at an object in the "logbook-photos" bucket (preferred).
-- photo_url is a fallback for hosted URLs; do NOT sync data URLs into this column.
create table if not exists public.logbook_trip_photos (
  id           uuid primary key default gen_random_uuid(),
  trip_id      uuid not null references public.logbook_trips (id) on delete cascade,
  storage_path text,
  photo_url    text,
  caption      text,
  position     integer not null default 0,
  created_at   timestamptz not null default now(),
  check (storage_path is not null or photo_url is not null)
);

comment on table public.logbook_trip_photos is 'Photos attached to logbook trips; prefer Supabase Storage paths over inline URLs.';

create index if not exists logbook_trips_user_date_idx  on public.logbook_trips (user_id, trip_date desc);
create index if not exists logbook_trip_photos_trip_idx on public.logbook_trip_photos (trip_id, position);

-- Keep updated_at fresh.
create or replace function public.touched_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists logbook_trips_touch_updated_at on public.logbook_trips;
create trigger logbook_trips_touch_updated_at
  before update on public.logbook_trips
  for each row execute function public.touched_updated_at();

-- Row-level security: users only see and edit their own trips.
alter table public.logbook_trips       enable row level security;
alter table public.logbook_trip_photos enable row level security;

drop policy if exists "logbook trips are owner-only" on public.logbook_trips;
create policy "logbook trips are owner-only" on public.logbook_trips
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "logbook photos follow trip owner" on public.logbook_trip_photos;
create policy "logbook photos follow trip owner" on public.logbook_trip_photos
  for all
  using (
    exists (
      select 1 from public.logbook_trips t
      where t.id = logbook_trip_photos.trip_id
        and t.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.logbook_trips t
      where t.id = logbook_trip_photos.trip_id
        and t.user_id = auth.uid()
    )
  );

-- Recommended private storage bucket for photos (run once):
-- insert into storage.buckets (id, name, public)
-- values ('logbook-photos', 'logbook-photos', false)
-- on conflict (id) do nothing;
