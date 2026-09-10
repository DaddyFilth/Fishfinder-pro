-- Create profiles table linked to auth.users
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  full_name text,
  avatar_url text,
  role text not null default 'angler',
  created_at timestamptz not null default now()
);

-- Add the RBAC column safely for databases created with an older schema.
alter table public.profiles add column if not exists role text;
update public.profiles set role = 'angler' where role is null;
alter table public.profiles alter column role set default 'angler';
alter table public.profiles alter column role set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_role_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_role_check check (role in ('angler', 'moderator', 'admin'));
  end if;
end;
$$;

alter table public.profiles enable row level security;

drop policy if exists "Users can view all profiles" on public.profiles;
create policy "Users can view all profiles"
on public.profiles
for select
using (true);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
on public.profiles
for insert
with check (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

drop policy if exists "Admins can manage profiles" on public.profiles;
create policy "Admins can manage profiles"
on public.profiles
for update
using (public.is_admin())
with check (role in ('angler', 'moderator', 'admin'));

create or replace function public.prevent_profile_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role
     and auth.uid() is not null
     and auth.uid() = old.id
     and not public.is_admin() then
    raise exception 'Only administrators can change account roles';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_profile_role_escalation on public.profiles;
create trigger prevent_profile_role_escalation
  before update on public.profiles
  for each row execute function public.prevent_profile_role_escalation();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url, role)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url',
    'angler'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
-- -----------------------------------------------------------------------------
-- Environmental conditions cache
-- -----------------------------------------------------------------------------

create table if not exists public.environmental_snapshots (
  id bigint generated always as identity primary key,
  spot_id text not null,
  captured_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.environmental_snapshots is
  'Short-lived server-side cache for assembled environmental conditions by fishing spot.';

comment on column public.environmental_snapshots.spot_id is
  'Application fishing-spot identifier, stored as text to support numeric and string IDs.';

comment on column public.environmental_snapshots.captured_at is
  'UTC timestamp representing when the conditions payload was assembled.';

comment on column public.environmental_snapshots.payload is
  'JSON response payload assembled from weather, water, and other conditions providers.';

create index if not exists environmental_snapshots_spot_captured_at_idx
  on public.environmental_snapshots (spot_id, captured_at desc);

create index if not exists environmental_snapshots_captured_at_idx
  on public.environmental_snapshots (captured_at desc);

alter table public.environmental_snapshots enable row level security;

revoke all on table public.environmental_snapshots from anon;
revoke all on table public.environmental_snapshots from authenticated;
revoke all on sequence public.environmental_snapshots_id_seq from anon;
revoke all on sequence public.environmental_snapshots_id_seq from authenticated;

grant select, insert, delete on table public.environmental_snapshots to service_role;
grant usage, select on sequence public.environmental_snapshots_id_seq to service_role;


-- Environmental snapshot cache schema
create table if not exists public.environmental_snapshots (
  id bigint generated always as identity primary key,
  spot_id text not null,
  captured_at timestamptz not null default now(),
  air_temp_c numeric,
  wind_speed_ms numeric,
  water_temp_c numeric,
  water_level_m numeric,
  flow_rate_cfs numeric,
  dissolved_oxygen_mgl numeric,
  wave_height_m numeric,
  wave_period_s numeric,
  swell_direction_deg numeric,
  tide_height_m numeric,
  fishing_score numeric,
  score_breakdown jsonb not null default '{}'::jsonb,
  data_sources jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.environmental_snapshots
  add column if not exists spot_id text,
  add column if not exists captured_at timestamptz not null default now(),
  add column if not exists air_temp_c numeric,
  add column if not exists wind_speed_ms numeric,
  add column if not exists water_temp_c numeric,
  add column if not exists water_level_m numeric,
  add column if not exists flow_rate_cfs numeric,
  add column if not exists dissolved_oxygen_mgl numeric,
  add column if not exists wave_height_m numeric,
  add column if not exists wave_period_s numeric,
  add column if not exists swell_direction_deg numeric,
  add column if not exists tide_height_m numeric,
  add column if not exists fishing_score numeric,
  add column if not exists score_breakdown jsonb not null default '{}'::jsonb,
  add column if not exists data_sources jsonb not null default '[]'::jsonb,
  add column if not exists created_at timestamptz not null default now();

create index if not exists environmental_snapshots_spot_captured_at_idx
  on public.environmental_snapshots (spot_id, captured_at desc);

create index if not exists environmental_snapshots_captured_at_idx
  on public.environmental_snapshots (captured_at desc);

alter table public.environmental_snapshots enable row level security;

revoke all on table public.environmental_snapshots from anon;
revoke all on table public.environmental_snapshots from authenticated;

grant select, insert, delete on table public.environmental_snapshots to service_role;

comment on table public.environmental_snapshots is
  'Short-lived server-side cache of environmental conditions for fishing spots.';
