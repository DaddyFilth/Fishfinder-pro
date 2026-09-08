import type { Spot } from '@/lib/mapFilters';

/**
 * Curated nationwide map fixtures keep exploration useful during first-run and
 * whenever the optional Supabase database is unavailable.
 */
export const DEFAULT_SPOTS: readonly Spot[] = [
  { id: '00000000-0000-4000-8000-000000000001', name: 'Lake Thunderbird', lat: 35.215, lng: -97.281, water_type: 'freshwater', spot_type: 'lake' },
  { id: '00000000-0000-4000-8000-000000000002', name: 'Lake Hefner', lat: 35.588, lng: -97.588, water_type: 'freshwater', spot_type: 'lake' },
  { id: '00000000-0000-4000-8000-000000000003', name: 'Lake Eufaula', lat: 35.304, lng: -95.583, water_type: 'freshwater', spot_type: 'reservoir' },
  { id: '00000000-0000-4000-8000-000000000004', name: 'Lake Texoma', lat: 33.817, lng: -96.610, water_type: 'freshwater', spot_type: 'reservoir' },
  { id: '00000000-0000-4000-8000-000000000005', name: 'Arkansas River — Tulsa', lat: 36.145, lng: -96.006, water_type: 'freshwater', spot_type: 'river' },
  { id: '00000000-0000-4000-8000-000000000006', name: 'Broken Bow Lake', lat: 34.180, lng: -94.752, water_type: 'freshwater', spot_type: 'lake' },
  { id: '00000000-0000-4000-8000-000000000007', name: 'Red River — Denison', lat: 33.785, lng: -96.583, water_type: 'freshwater', spot_type: 'river' },
  { id: '00000000-0000-4000-8000-000000000008', name: 'Lake Michigan — Chicago', lat: 41.895, lng: -87.600, water_type: 'freshwater', spot_type: 'lake' },
  { id: '00000000-0000-4000-8000-000000000009', name: 'Lake Erie — Cleveland', lat: 41.510, lng: -81.700, water_type: 'freshwater', spot_type: 'lake' },
  { id: '00000000-0000-4000-8000-000000000010', name: 'Lake Superior — Duluth', lat: 46.780, lng: -92.090, water_type: 'freshwater', spot_type: 'lake' },
  { id: '00000000-0000-4000-8000-000000000011', name: 'Lake Okeechobee', lat: 26.950, lng: -80.800, water_type: 'freshwater', spot_type: 'lake' },
  { id: '00000000-0000-4000-8000-000000000012', name: 'Everglades National Park', lat: 25.286, lng: -80.898, water_type: 'saltwater', spot_type: 'marsh' },
  { id: '00000000-0000-4000-8000-000000000013', name: 'Chesapeake Bay — Annapolis', lat: 38.978, lng: -76.495, water_type: 'saltwater', spot_type: 'bay' },
  { id: '00000000-0000-4000-8000-000000000014', name: 'Cape Cod Bay', lat: 41.780, lng: -70.200, water_type: 'saltwater', spot_type: 'bay' },
  { id: '00000000-0000-4000-8000-000000000015', name: 'Hudson River — New York', lat: 40.720, lng: -74.010, water_type: 'saltwater', spot_type: 'river' },
  { id: '00000000-0000-4000-8000-000000000016', name: 'Lake Lanier', lat: 34.250, lng: -83.950, water_type: 'freshwater', spot_type: 'reservoir' },
  { id: '00000000-0000-4000-8000-000000000017', name: 'Lake Guntersville', lat: 34.390, lng: -86.250, water_type: 'freshwater', spot_type: 'reservoir' },
  { id: '00000000-0000-4000-8000-000000000018', name: 'Lake Norman', lat: 35.470, lng: -80.950, water_type: 'freshwater', spot_type: 'reservoir' },
  { id: '00000000-0000-4000-8000-000000000019', name: 'Lake Tahoe', lat: 39.096, lng: -120.032, water_type: 'freshwater', spot_type: 'lake' },
  { id: '00000000-0000-4000-8000-000000000020', name: 'Columbia River — Portland', lat: 45.650, lng: -122.750, water_type: 'freshwater', spot_type: 'river' },
  { id: '00000000-0000-4000-8000-000000000021', name: 'Puget Sound — Seattle', lat: 47.650, lng: -122.400, water_type: 'saltwater', spot_type: 'sound' },
  { id: '00000000-0000-4000-8000-000000000022', name: 'San Francisco Bay', lat: 37.800, lng: -122.400, water_type: 'saltwater', spot_type: 'bay' },
  { id: '00000000-0000-4000-8000-000000000023', name: 'Lake Mead', lat: 36.080, lng: -114.700, water_type: 'freshwater', spot_type: 'reservoir' },
  { id: '00000000-0000-4000-8000-000000000024', name: 'Lake Powell', lat: 37.070, lng: -111.240, water_type: 'freshwater', spot_type: 'reservoir' },
  { id: '00000000-0000-4000-8000-000000000025', name: 'Gulf Coast — Galveston', lat: 29.300, lng: -94.790, water_type: 'saltwater', spot_type: 'coast' },
  { id: '00000000-0000-4000-8000-000000000026', name: 'Lake Travis', lat: 30.440, lng: -97.970, water_type: 'freshwater', spot_type: 'reservoir' },
  { id: '00000000-0000-4000-8000-000000000027', name: 'Mississippi River — St. Louis', lat: 38.630, lng: -90.180, water_type: 'freshwater', spot_type: 'river' },
  { id: '00000000-0000-4000-8000-000000000028', name: 'Lake of the Ozarks', lat: 38.180, lng: -92.650, water_type: 'freshwater', spot_type: 'reservoir' },
  { id: '00000000-0000-4000-8000-000000000029', name: 'Yellowstone Lake', lat: 44.500, lng: -110.300, water_type: 'freshwater', spot_type: 'lake' },
  { id: '00000000-0000-4000-8000-000000000030', name: 'Lake Champlain', lat: 44.530, lng: -73.330, water_type: 'freshwater', spot_type: 'lake' },
  { id: '00000000-0000-4000-8000-000000000031', name: 'Purcell Lake', lat: 34.990139, lng: -97.389444, water_type: 'freshwater', spot_type: 'lake' },
  { id: '00000000-0000-4000-8000-000000000032', name: 'Pauls Valley City Lake', lat: 34.782694, lng: -97.204444, water_type: 'freshwater', spot_type: 'lake' },
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
    score_breakdown: { total: score, components: { weather: 78, water: 72, conditions: 69 }, recommendations: ['Local demo conditions are available while live data is offline.'], warnings: [] },
    data_sources: ['Local fallback'],
    cached: false,
    captured_at: new Date().toISOString(),
  };
}
