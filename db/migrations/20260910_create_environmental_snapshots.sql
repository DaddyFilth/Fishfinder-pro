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
