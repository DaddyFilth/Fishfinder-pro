import type { Spot } from '@/lib/mapFilters';

/** Public Oklahoma waters used when the database is unavailable. Coordinates are water-body centers, not guaranteed access gates. */
export const DEFAULT_SPOTS: readonly Spot[] = [
  ['Lake Thunderbird',35.215,-97.281,'lake'],['Lake Hefner',35.588,-97.588,'lake'],['Lake Eufaula',35.304,-95.583,'reservoir'],['Lake Texoma',33.817,-96.61,'reservoir'],['Arkansas River — Tulsa',36.145,-96.006,'river'],['Broken Bow Lake',34.18,-94.752,'lake'],['Lake Tenkiller',35.625,-95.05,'reservoir'],['Foss Lake',35.555,-99.17,'reservoir'],['Grand Lake o’ the Cherokees',36.52,-95.02,'reservoir'],['Lake Murray',34.08,-97.08,'lake'],['Kaw Lake',36.75,-96.88,'reservoir'],['Keystone Lake',36.18,-96.38,'reservoir'],['Oologah Lake',36.62,-95.75,'reservoir'],['Fort Gibson Lake',35.79,-95.26,'reservoir'],['Lake Skiatook',36.37,-96.13,'reservoir'],['Copan Lake',36.91,-95.92,'reservoir'],['Sooner Lake',36.48,-97.07,'lake'],['Lake Carl Blackwell',36.16,-97.29,'lake'],['Lake McMurtry',36.22,-97.46,'lake'],['Arcadia Lake',35.67,-97.33,'lake'],['Lake Stanley Draper',35.4,-97.39,'lake'],['Lake Altus-Lugert',34.93,-99.3,'reservoir'],['Lake Lawtonka',34.92,-98.47,'reservoir'],['Lake Waurika',34.73,-98.0,'reservoir'],['Lake Ellsworth',34.72,-98.36,'reservoir'],['Lake Hugo',34.01,-95.5,'reservoir'],['McGee Creek Reservoir',34.33,-96.99,'reservoir'],['Atoka Lake',34.43,-96.0,'lake'],['Lake Arbuckle',34.44,-97.02,'lake'],['Lake Chickasha',35.1,-98.25,'lake'],['Lake Elmer Thomas',34.66,-98.49,'lake'],['Lake Overholser',35.53,-97.66,'lake'],['Purcell Lake',34.990139,-97.389444,'lake'],['Pauls Valley City Lake',34.782694,-97.204444,'lake'],['Canadian River — Norman',35.23,-97.44,'river'],['North Canadian River — Oklahoma City',35.47,-97.52,'river'],['Illinois River — Tahlequah',35.91,-94.97,'river'],['Red River — Colbert',33.85,-96.5,'river'],['Neosho River — Miami',36.89,-94.88,'river'],['Kiamichi River — Clayton',34.59,-95.35,'river']].map(([name, lat, lng, spot_type], index) => ({ id: `ok-${String(index + 1).padStart(3, '0')}`, name: String(name), lat: Number(lat), lng: Number(lng), water_type: 'freshwater', spot_type: String(spot_type) }));

export const OKLAHOMA_COVERAGE_SOURCE = 'https://www.wildlifedepartment.com/fishing/wheretofish';
export const OKLAHOMA_BOUNDS = { minLat: 33.6, maxLat: 37.1, minLng: -103.1, maxLng: -94.4 };

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
