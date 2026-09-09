import type { Spot } from '@/lib/mapFilters';

/**
 * Oklahoma public-access fixtures keep the map useful when the optional
 * Supabase spots table is unavailable. Coordinates are map pins for named
 * public or managed waters; anglers should verify current access, permits,
 * closures, and regulations with the named managing agency before traveling.
 */
const source = 'ODWC / municipal public access';

const spot = (
  id: number,
  name: string,
  lat: number,
  lng: number,
  spot_type: Spot['spot_type'],
  access_type: NonNullable<Spot['access_type']>,
  region: NonNullable<Spot['region']>,
  notes: string,
): Spot => ({
  id: `00000000-0000-4000-8000-${String(id).padStart(12, '0')}`,
  name,
  lat,
  lng,
  water_type: 'freshwater',
  spot_type,
  access_type,
  region,
  source,
  notes,
});

export const DEFAULT_SPOTS: readonly Spot[] = [
  // Oklahoma City public waters
  spot(1, 'Lake Hefner', 35.588, -97.588, 'lake', 'Fishing pier', 'Central', 'City lake with shoreline, marina, and accessible pier access.'),
  spot(2, 'Lake Overholser', 35.515, -97.646, 'lake', 'Boat ramp', 'Central', 'City lake with public ramps, shoreline, and fishing piers.'),
  spot(3, 'Lake Stanley Draper', 35.391, -97.416, 'lake', 'Boat ramp', 'Central', 'City lake with multiple public points, ramps, and fishing piers.'),
  spot(4, 'Oklahoma River', 35.447, -97.518, 'river', 'Municipal water', 'Central', 'Public river access in Oklahoma City; city permit rules apply.'),
  spot(5, 'Stinchcomb Wildlife Refuge', 35.537, -97.695, 'wma', 'Public shore', 'Central', 'Public wildlife refuge water access near Oklahoma City.'),
  spot(6, 'Crystal Lake OKC', 35.453, -97.621, 'municipal', 'Fishing pier', 'Central', 'City fishing water with south-side dock access.'),
  spot(7, 'Dolese Youth Park Pond', 35.521, -97.571, 'municipal', 'Fishing pier', 'Central', 'City pond with accessible west-side fishing pads.'),
  spot(8, 'Edwards Park Fishing Lake', 35.519, -97.444, 'municipal', 'Fishing pier', 'Central', 'Public city fishing pond with dock access.'),
  spot(9, "Kids' Lake OKC", 35.528, -97.595, 'municipal', 'Fishing pier', 'Central', 'Close-to-home city fishing water with public docks.'),
  spot(10, 'Kitchen Lake', 35.368, -97.443, 'municipal', 'Fishing pier', 'Central', 'City pond with public shoreline and dock access.'),
  spot(11, 'Route 66 Park Ponds', 35.492, -97.635, 'municipal', 'Public shore', 'Central', 'Public city ponds; seasonal trout access may apply.'),
  spot(12, 'South Lakes Park Ponds', 35.391, -97.579, 'municipal', 'Fishing pier', 'Central', 'Public city ponds with fishing dock access.'),
  spot(13, 'Zoo Lake', 35.523, -97.474, 'municipal', 'Public shore', 'Central', 'City-managed public fishing water near the Oklahoma City Zoo.'),
  // Major reservoirs and public lakes
  spot(14, 'Lake Thunderbird', 35.215, -97.281, 'reservoir', 'Boat ramp', 'Central', 'State park and public-use reservoir east of Norman.'),
  spot(15, 'Lake Eufaula', 35.304, -95.583, 'reservoir', 'Boat ramp', 'Southeast', 'Large public reservoir with state park, marina, and shore access.'),
  spot(16, 'Lake Texoma', 33.817, -96.610, 'reservoir', 'Boat ramp', 'Southwest', 'Public reservoir on the Red River; verify state-line regulations.'),
  spot(17, 'Broken Bow Lake', 34.180, -94.752, 'reservoir', 'State park', 'Southeast', 'Public lake and Beavers Bend area with extensive access.'),
  spot(18, 'Lake Tenkiller', 35.630, -95.014, 'reservoir', 'Boat ramp', 'Northeast', 'Public reservoir with state park and multiple ramps.'),
  spot(19, 'Grand Lake O\' the Cherokees', 36.536, -95.007, 'reservoir', 'Boat ramp', 'Northeast', 'Public reservoir with state parks, marinas, and access points.'),
  spot(20, 'Fort Gibson Lake', 35.800, -95.250, 'reservoir', 'Boat ramp', 'Northeast', 'Public Corps and state access around the reservoir.'),
  spot(21, 'Keystone Lake', 36.180, -96.410, 'reservoir', 'Boat ramp', 'Northeast', 'Public-use areas, courtesy docks, and tailwater access.'),
  spot(22, 'Kaw Lake', 36.735, -97.110, 'reservoir', 'Boat ramp', 'Northwest', 'Public-use reservoir and spillway access.'),
  spot(23, 'Oologah Lake', 36.720, -95.700, 'reservoir', 'Boat ramp', 'Northeast', 'Public Corps reservoir with shoreline and ramp access.'),
  spot(24, 'Skiatook Lake', 36.370, -96.110, 'reservoir', 'Boat ramp', 'Northeast', 'Public lake access near Tulsa and Osage County.'),
  spot(25, 'Fort Supply Lake', 36.560, -99.570, 'reservoir', 'Public shore', 'Northwest', 'Public pull-offs and dam-area fishing access.'),
  spot(26, 'Canton Lake', 36.080, -98.580, 'reservoir', 'Boat ramp', 'Northwest', 'Public lake, spillway, and accessible fishing areas.'),
  spot(27, 'Foss Lake', 35.470, -99.190, 'reservoir', 'Fishing pier', 'Southwest', 'Public lake with marina dock and shoreline access.'),
  spot(28, 'Great Salt Plains Lake', 36.800, -98.120, 'lake', 'Fishing pier', 'Northwest', 'Public lake, spillway jetty, and refuge-area access.'),
  spot(29, 'Lake Carl Blackwell', 36.150, -97.350, 'lake', 'Fishing pier', 'Central', 'Public lake west of Stillwater with park and Turtle Pond access.'),
  spot(30, 'Lake Murray', 34.080, -97.090, 'lake', 'State park', 'Southwest', 'Public state park lake in Carter and Love counties.'),
  spot(31, 'Lake Arbuckle', 34.425, -97.040, 'lake', 'State park', 'Southwest', 'Public lake in the Chickasaw National Recreation Area region.'),
  spot(32, 'Lake McGee Creek', 34.330, -96.760, 'reservoir', 'Boat ramp', 'Southeast', 'Public reservoir and wildlife management access.'),
  spot(33, 'Lake Sardis', 34.690, -95.620, 'reservoir', 'Boat ramp', 'Southeast', 'Public reservoir in the Kiamichi region.'),
  spot(34, 'Lake Hugo', 34.030, -95.520, 'reservoir', 'Boat ramp', 'Southeast', 'Public reservoir with state park and Corps access.'),
  spot(35, 'Lake Wister', 34.860, -94.720, 'reservoir', 'Boat ramp', 'Southeast', 'Public reservoir and state park access.'),
  spot(36, 'Lawtonka Lake', 34.870, -98.500, 'lake', 'Boat ramp', 'Southwest', 'Public lake north of Lawton with shoreline and ramp access.'),
  spot(37, 'Altus-Lugert Lake', 34.930, -99.270, 'reservoir', 'Boat ramp', 'Southwest', 'Public western Oklahoma reservoir; verify current water access.'),
  spot(38, 'Boomer Lake', 36.140, -97.070, 'municipal', 'Fishing pier', 'Central', 'Stillwater municipal lake with public dock access.'),
  spot(39, 'Government Springs Park Lake', 36.395, -97.880, 'municipal', 'Fishing pier', 'Northwest', 'Enid public fishing docks.'),
  spot(40, 'Hominy Municipal Lake', 36.420, -96.390, 'municipal', 'Fishing pier', 'Northeast', 'Public municipal lake with accessible fishing dock.'),
  // Rivers and designated trout/public fishing areas
  spot(41, 'Lower Mountain Fork River Trout Area', 34.170, -94.740, 'trout', 'State park', 'Southeast', 'Designated trout water with bank and boat access below Broken Bow Dam.'),
  spot(42, 'Blue River Public Fishing Area', 34.230, -96.420, 'trout', 'Walk-in', 'Southeast', 'Public fishing and hunting area with bank and wading access.'),
  spot(43, 'Lower Illinois River Trout Area', 35.880, -95.150, 'trout', 'Walk-in', 'Northeast', 'Designated trout water with multiple public access sites.'),
  spot(44, 'Robbers Cave Trout Area', 34.900, -95.320, 'trout', 'State park', 'Southeast', 'Fourche Maline River access within Robbers Cave State Park.'),
  spot(45, 'Medicine Creek Trout Area', 34.730, -98.990, 'trout', 'Public shore', 'Southwest', 'Designated trout area with town and roadside access.'),
  spot(46, 'Sunset Lake Guymon', 36.690, -101.480, 'trout', 'Fishing pier', 'Northwest', 'Municipal stocked trout lake with walking trail and dock.'),
  spot(47, 'Lake Carl Blackwell Turtle Pond', 36.160, -97.350, 'trout', 'Fishing pier', 'Central', 'Seasonal trout water with heated dock near the park office.'),
  spot(48, 'Arkansas River — Tulsa', 36.145, -96.006, 'river', 'Public shore', 'Northeast', 'Public river access through the Tulsa urban corridor.'),
  spot(49, 'Neosho River — Miami', 36.890, -94.880, 'river', 'Public shore', 'Northeast', 'Public river corridor; verify access at the selected launch or park.'),
  spot(50, 'Red River — Lake Texoma', 33.817, -96.610, 'river', 'Boat ramp', 'Southwest', 'Public river/reservoir access near the Oklahoma-Texas border.'),
];

export function getDefaultCondition(spot: Spot) {
  const score = spot.spot_type === 'river' || spot.spot_type === 'trout' ? 74 : spot.spot_type === 'reservoir' ? 68 : 71;
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
      recommendations: ['Local Oklahoma public-access conditions are available while live data is offline.'],
      warnings: ['Verify current access, permits, closures, and water levels before traveling.'],
    },
    data_sources: ['Local Oklahoma public-access fallback'],
    cached: false,
    captured_at: new Date().toISOString(),
  };
}
