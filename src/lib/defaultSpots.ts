import type { Spot } from '@/lib/mapFilters';

/**
 * Local map fixtures keep the exploration surface usable during first-run and
 * when the optional Supabase database is unavailable. Production data still
 * takes precedence whenever the API can read the database.
 */
export const DEFAULT_SPOTS: readonly Spot[] = [
  { id: '00000000-0000-4000-8000-000000000001', name: 'Lake Thunderbird', lat: 35.215, lng: -97.281, water_type: 'freshwater', spot_type: 'lake' },
  { id: '00000000-0000-4000-8000-000000000002', name: 'Lake Hefner', lat: 35.588, lng: -97.588, water_type: 'freshwater', spot_type: 'lake' },
  { id: '00000000-0000-4000-8000-000000000003', name: 'Lake Eufaula', lat: 35.304, lng: -95.583, water_type: 'freshwater', spot_type: 'reservoir' },
  { id: '00000000-0000-4000-8000-000000000004', name: 'Lake Texoma', lat: 33.817, lng: -96.610, water_type: 'freshwater', spot_type: 'reservoir' },
  { id: '00000000-0000-4000-8000-000000000005', name: 'Arkansas River — Tulsa', lat: 36.145, lng: -96.006, water_type: 'freshwater', spot_type: 'river' },
  { id: '00000000-0000-4000-8000-000000000006', name: 'Broken Bow Lake', lat: 34.180, lng: -94.752, water_type: 'freshwater', spot_type: 'lake' },
  { id: '00000000-0000-4000-8000-000000000007', name: 'Red River — Denison', lat: 33.785, lng: -96.583, water_type: 'freshwater', spot_type: 'river' },
];

export function getDefaultCondition(spot: Spot) {
  const score = spot.spot_type === 'river' ? 74 : spot.spot_type === 'reservoir' ? 68 : 71;
  return {
    spot_id: spot.id,
    air_temp_c: 22,
    water_temp_c: 19,
    water_level_m: spot.spot_type === 'river' ? 1.2 : 2.8,
    flow_rate_cfs: spot.spot_type === 'river' ? 620 : null,
    wind_speed_ms: 3.4,
    wind_dir_deg: 180,
    dissolved_oxygen_mgl: 7.6,
    wave_height_m: null,
    wave_period_s: null,
    swell_direction_deg: null,
    tide_height_m: null,
    tide_type: null,
    pressure_hpa: 1015,
    humidity_pct: 54,
    turbidity_ntu: 3.8,
    ph: 7.4,
    fishing_score: score,
    score_breakdown: {
      total: score,
      components: { weather: 78, water: 72, conditions: 69 },
      recommendations: ['Local demo conditions are available while live data is offline.'],
      warnings: [],
    },
    data_sources: ['Local fallback'],
    cached: false,
    captured_at: new Date().toISOString(),
  };
}

