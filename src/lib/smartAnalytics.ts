import type { SupabaseClient } from '@supabase/supabase-js';
import { DEFAULT_SPOTS } from './defaultSpots';
import { SPECIES, type Species } from './speciesCatalog';
import { calculateFishingScore, type ScoreBreakdown } from './scoring/fishingScore';
import { fetchNWSConditions, fetchMarineConditions, fetchPressureTrend } from './fetchers/environmental';
import { distanceMiles } from './nearbySpots';
import { searchFishingInfo } from './webSearch';

/**
 * Smart analytics inputs.
 *
 * Every analysis is assembled from independent sources so the response can say
 * exactly which ones answered. No source is allowed to silently substitute for
 * another: a failed provider stays "unavailable" instead of being back-filled
 * with invented readings.
 *
 * While the community catch log is still small, the analysis runs in the
 * `bootstrap` phase and leans on provider readings, stored environmental
 * history, the bundled catalog and search-derived research. Once enough logged
 * catches exist near the area it switches to `community` and weights them.
 */

export const CATCH_LOG_SUFFICIENT_TOTAL = 50;
export const CATCH_LOG_SUFFICIENT_NEARBY = 10;
export const CATCH_LOG_SAMPLE_LIMIT = 500;
export const COMMUNITY_SAMPLE_LIMIT = 100;
export const HISTORY_SAMPLE_LIMIT = 200;
export const HISTORY_WINDOW_DAYS = 30;
export const NEARBY_RADIUS_MILES = 50;
export const CATALOG_SPOT_LIMIT = 12;
export const CATALOG_SPECIES_LIMIT = 12;

export type SourceState = 'ok' | 'empty' | 'unavailable';

export type SourceId =
  | 'provider-conditions'
  | 'environmental-history'
  | 'spot-catalog'
  | 'species-catalog'
  | 'catch-log'
  | 'community-reports'
  | 'web-search';

export interface SourceStatus {
  id: SourceId;
  label: string;
  status: SourceState;
  mode: 'provider' | 'database' | 'local-catalog' | 'community' | 'search-derived' | 'deterministic';
  note: string;
}

export interface ProviderConditions {
  status: SourceState;
  providers: string[];
  captured_at: string | null;
  air_temp_f: number | null;
  wind_speed_mph: number | null;
  wind_direction: string | null;
  short_forecast: string | null;
  pressure_hpa: number | null;
  pressure_trend: 'rising' | 'falling' | 'stable' | null;
  sea_surface_temp_f: number | null;
  wave_height_ft: number | null;
  fishing_score: number | null;
  score_breakdown: ScoreBreakdown | null;
}

export interface CatchLogInsights {
  status: SourceState;
  own_logged: number;
  public_logged: number;
  total: number;
  nearby: number;
  recent_30d: number;
  top_species: Array<{ species: string; count: number }>;
  top_baits: Array<{ bait: string; count: number }>;
  sufficient: boolean;
  note: string;
}

export interface CommunityInsights {
  status: SourceState;
  authenticated: boolean;
  nearby_reports: Array<{ pin_type: string; title: string; known_spot_id: string; distance_miles: number }>;
  note: string;
}

export interface EnvironmentalHistory {
  status: SourceState;
  samples: number;
  spots_covered: number;
  window_days: number;
  avg_water_temp_f: number | null;
  avg_air_temp_f: number | null;
  avg_fishing_score: number | null;
  latest_captured_at: string | null;
  note: string;
}

export interface WebResearch {
  status: SourceState;
  query: string;
  summary: string | null;
  related: Array<{ text: string; url: string | null }>;
  note: string;
}

export interface CatalogContext {
  status: SourceState;
  nearby_spots: Array<{
    id: string;
    name: string;
    lat: number;
    lng: number;
    water_type: string;
    spot_type: string;
    region: string | null;
    distance_miles: number;
  }>;
  species: Array<{
    id: string;
    name: string;
    scientific_name: string;
    habitat: string;
    best_bait: readonly string[];
    best_time: string;
    depth: string;
    tips: string;
    opt_water_temp_f_min: number | null;
    opt_water_temp_f_max: number | null;
  }>;
}

export interface SmartAnalyticsInput {
  lat: number;
  lng: number;
  targetSpecies?: string;
  saltwater?: boolean;
  region?: string;
}

export interface SmartAnalyticsSources {
  sources: SourceStatus[];
  provider: ProviderConditions;
  catchLog: CatchLogInsights;
  community: CommunityInsights;
  history: EnvironmentalHistory;
  web: WebResearch;
  catalog: CatalogContext;
  data_phase: 'bootstrap' | 'community';
}

const cToF = (celsius: number | null | undefined): number | null =>
  typeof celsius === 'number' && Number.isFinite(celsius)
    ? Math.round((celsius * 9) / 5 + 32)
    : null;

const msToMph = (metersPerSecond: number | null | undefined): number | null =>
  typeof metersPerSecond === 'number' && Number.isFinite(metersPerSecond)
    ? Math.round(metersPerSecond * 2.23694 * 10) / 10
    : null;

const mToFeet = (metres: number | null | undefined): number | null =>
  typeof metres === 'number' && Number.isFinite(metres)
    ? Math.round(metres * 3.28084 * 10) / 10
    : null;

function countBy(rows: Array<{ key: string | null }>): Array<{ key: string; count: number }> {
  const tally = new Map<string, number>();
  for (const row of rows) {
    const key = row.key?.trim();
    if (!key) continue;
    tally.set(key, (tally.get(key) ?? 0) + 1);
  }
  return [...tally.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count);
}

/** Live provider readings for one coordinate. Never throws; failures report as unavailable. */
export async function fetchProviderConditions(
  lat: number,
  lng: number,
  saltwater: boolean,
): Promise<ProviderConditions> {
  const [nws, pressure, marine] = await Promise.all([
    fetchNWSConditions(lat, lng).catch(() => null),
    fetchPressureTrend(lat, lng).catch(() => null),
    saltwater ? fetchMarineConditions(lat, lng).catch(() => null) : Promise.resolve(null),
  ]);

  const providers: string[] = [];
  if (nws) providers.push(nws.source);
  if (pressure) providers.push('Open-Meteo Pressure');
  if (marine) providers.push(marine.source);

  const pressureHpa =
    typeof pressure?.currentPressure === 'number' && Number.isFinite(pressure.currentPressure)
      ? Math.round(pressure.currentPressure * 10) / 10
      : null;

  const scoreInput = {
    air_temp_c: nws?.air_temp_c ?? null,
    water_temp_c: marine?.sea_surface_temp_c ?? null,
    pressure_hpa: pressureHpa,
    wind_speed_ms: nws?.wind_speed_ms ?? null,
    wave_height_m: marine?.wave_height_m ?? null,
    is_daytime: nws?.is_daytime ?? undefined,
  };
  const breakdown = providers.length > 0 ? calculateFishingScore(scoreInput) : null;

  return {
    status: providers.length > 0 ? 'ok' : 'unavailable',
    providers,
    captured_at: providers.length > 0 ? new Date().toISOString() : null,
    air_temp_f: cToF(nws?.air_temp_c),
    wind_speed_mph: msToMph(nws?.wind_speed_ms),
    wind_direction: nws?.wind_direction ?? null,
    short_forecast: nws?.short_forecast ?? null,
    pressure_hpa: pressureHpa,
    pressure_trend: pressure?.trend ?? null,
    sea_surface_temp_f: cToF(marine?.sea_surface_temp_c),
    wave_height_ft: mToFeet(marine?.wave_height_m),
    fishing_score: breakdown?.total ?? null,
    score_breakdown: breakdown,
  };
}

type CatchRow = {
  id: string;
  species: string | null;
  bait: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string | null;
};

/**
 * Aggregated catch-log signal for the analysis.
 *
 * Only counts and histograms leave this function: no user ids, notes, photos or
 * coordinates are ever exposed. Personal rows come from the signed-in session
 * plus explicitly public rows, matching what those users chose to share.
 */
export async function fetchCatchLogInsights(
  supabase: SupabaseClient | null,
  options: { userId?: string | null; lat: number; lng: number },
): Promise<CatchLogInsights> {
  const empty: CatchLogInsights = {
    status: 'unavailable',
    own_logged: 0,
    public_logged: 0,
    total: 0,
    nearby: 0,
    recent_30d: 0,
    top_species: [],
    top_baits: [],
    sufficient: false,
    note: 'Catch log database is not configured, so no logged catches were analyzed.',
  };
  if (!supabase) return empty;

  try {
    const select = 'id, species, bait, latitude, longitude, created_at';
    const [own, shared] = await Promise.all([
      options.userId
        ? supabase.from('catches').select(select).eq('user_id', options.userId).limit(CATCH_LOG_SAMPLE_LIMIT)
        : Promise.resolve({ data: [] as CatchRow[], error: null }),
      supabase.from('catches').select(select).eq('is_public', true).limit(CATCH_LOG_SAMPLE_LIMIT),
    ]);

    if (own.error || shared.error) return empty;

    const byId = new Map<string, CatchRow>();
    for (const row of [...(own.data ?? []), ...(shared.data ?? [])] as CatchRow[]) {
      if (row?.id) byId.set(row.id, row);
    }
    const rows = [...byId.values()];
    if (rows.length === 0) {
      return {
        ...empty,
        status: 'empty',
        note: 'No logged catches yet. Analysis is running in bootstrap mode from provider, catalog and research sources.',
      };
    }

    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const near = rows.filter((row) => {
      if (typeof row.latitude !== 'number' || typeof row.longitude !== 'number') return false;
      if (!Number.isFinite(row.latitude) || !Number.isFinite(row.longitude)) return false;
      return distanceMiles(
        { latitude: options.lat, longitude: options.lng },
        { latitude: row.latitude, longitude: row.longitude },
      ) <= NEARBY_RADIUS_MILES;
    });

    const ownIds = new Set<string>();
    if (own.data) for (const row of own.data as CatchRow[]) ownIds.add(row.id);
    const sharedIds = new Set<string>();
    for (const row of (shared.data ?? []) as CatchRow[]) sharedIds.add(row.id);

    const total = rows.length;
    const nearby = near.length;
    const sufficient = total >= CATCH_LOG_SUFFICIENT_TOTAL && nearby >= CATCH_LOG_SUFFICIENT_NEARBY;

    return {
      status: 'ok',
      own_logged: ownIds.size,
      public_logged: sharedIds.size,
      total,
      nearby,
      recent_30d: rows.filter((row) => {
        const at = row.created_at ? Date.parse(row.created_at) : Number.NaN;
        return Number.isFinite(at) && at >= cutoff;
      }).length,
      top_species: countBy(rows.map((row) => ({ key: row.species })))
        .slice(0, 8)
        .map(({ key, count }) => ({ species: key, count })),
      top_baits: countBy(rows.map((row) => ({ key: row.bait })))
        .slice(0, 8)
        .map(({ key, count }) => ({ bait: key, count })),
      sufficient,
      note: sufficient
        ? `Community catch log is substantial enough to weight (${total} logged, ${nearby} within ${NEARBY_RADIUS_MILES} mi).`
        : `Catch log is still building (${total} logged, ${nearby} within ${NEARBY_RADIUS_MILES} mi; needs ${CATCH_LOG_SUFFICIENT_TOTAL} and ${CATCH_LOG_SUFFICIENT_NEARBY} nearby), so external sources carry the analysis.`,
    };
  } catch {
    return empty;
  }
}

/** Community structure/hazard/access reports near the area. Signed-in accounts only, matching RLS. */
export async function fetchCommunityInsights(
  supabase: SupabaseClient | null,
  options: { authenticated: boolean; lat: number; lng: number },
): Promise<CommunityInsights> {
  if (!supabase || !options.authenticated) {
    return {
      status: 'unavailable',
      authenticated: false,
      nearby_reports: [],
      note: 'Community reports are visible to signed-in accounts only, so none were included.',
    };
  }

  try {
    const { data, error } = await supabase
      .from('community_map_pins')
      .select('pin_type, title, known_spot_id, lat, lng, expires_at')
      .limit(COMMUNITY_SAMPLE_LIMIT);

    if (error || !data) {
      return {
        status: 'unavailable',
        authenticated: true,
        nearby_reports: [],
        note: 'Community reports could not be read right now.',
      };
    }

    const now = Date.now();
    const nearby_reports = (data as Array<Record<string, unknown>>)
      .filter((row) => {
        const expires = typeof row.expires_at === 'string' ? Date.parse(row.expires_at) : Number.NaN;
        return !Number.isFinite(expires) || expires > now;
      })
      .map((row) => {
        const lat = Number(row.lat);
        const lng = Number(row.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        const miles = distanceMiles(
          { latitude: options.lat, longitude: options.lng },
          { latitude: lat, longitude: lng },
        );
        if (miles > NEARBY_RADIUS_MILES) return null;
        return {
          pin_type: String(row.pin_type ?? 'tip'),
          title: String(row.title ?? '').slice(0, 120),
          known_spot_id: String(row.known_spot_id ?? ''),
          distance_miles: Math.round(miles * 10) / 10,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null)
      .slice(0, 12);

    return {
      status: nearby_reports.length > 0 ? 'ok' : 'empty',
      authenticated: true,
      nearby_reports,
      note:
        nearby_reports.length > 0
          ? `${nearby_reports.length} community reports within ${NEARBY_RADIUS_MILES} mi.`
          : `No community reports within ${NEARBY_RADIUS_MILES} mi right now.`,
    };
  } catch {
    return {
      status: 'unavailable',
      authenticated: true,
      nearby_reports: [],
      note: 'Community reports could not be read right now.',
    };
  }
}

/** Stored provider snapshots written by the conditions route — the app's own conditions history. */
export async function fetchEnvironmentalHistory(
  supabase: SupabaseClient | null,
  options: { lat: number; lng: number },
): Promise<EnvironmentalHistory> {
  const empty: EnvironmentalHistory = {
    status: 'unavailable',
    samples: 0,
    spots_covered: 0,
    window_days: HISTORY_WINDOW_DAYS,
    avg_water_temp_f: null,
    avg_air_temp_f: null,
    avg_fishing_score: null,
    latest_captured_at: null,
    note: 'Stored environmental history is not configured.',
  };
  if (!supabase) return empty;

  const spotIds = DEFAULT_SPOTS
    .map((spot) => ({
      id: spot.id,
      miles: distanceMiles(
        { latitude: options.lat, longitude: options.lng },
        { latitude: spot.lat, longitude: spot.lng },
      ),
    }))
    .filter((entry) => entry.miles <= NEARBY_RADIUS_MILES * 2)
    .map((entry) => entry.id)
    .slice(0, 40);

  if (spotIds.length === 0) {
    return { ...empty, status: 'empty', note: 'No catalog waters are close enough to have stored history.' };
  }

  try {
    const since = new Date(Date.now() - HISTORY_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from('environmental_snapshots')
      .select('spot_id, captured_at, water_temp_c, air_temp_c, fishing_score')
      .in('spot_id', spotIds)
      .gte('captured_at', since)
      .order('captured_at', { ascending: false })
      .limit(HISTORY_SAMPLE_LIMIT);

    if (error || !data || data.length === 0) {
      return {
        ...empty,
        status: 'empty',
        note: `No provider snapshots were stored for nearby waters in the last ${HISTORY_WINDOW_DAYS} days.`,
      };
    }

    const rows = data as Array<Record<string, unknown>>;
    const average = (values: number[]): number | null =>
      values.length > 0 ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10 : null;
    const waterTemps = rows.map((row) => Number(row.water_temp_c)).filter((value) => Number.isFinite(value));
    const airTemps = rows.map((row) => Number(row.air_temp_c)).filter((value) => Number.isFinite(value));
    const scores = rows.map((row) => Number(row.fishing_score)).filter((value) => Number.isFinite(value));

    return {
      status: 'ok',
      samples: rows.length,
      spots_covered: new Set(rows.map((row) => String(row.spot_id))).size,
      window_days: HISTORY_WINDOW_DAYS,
      avg_water_temp_f: cToF(average(waterTemps)),
      avg_air_temp_f: cToF(average(airTemps)),
      avg_fishing_score: average(scores),
      latest_captured_at: typeof rows[0]?.captured_at === 'string' ? String(rows[0].captured_at) : null,
      note: `${rows.length} stored readings across ${new Set(rows.map((row) => String(row.spot_id))).size} nearby waters in the last ${HISTORY_WINDOW_DAYS} days.`,
    };
  } catch {
    return empty;
  }
}

/** Search-derived research used to cross-check the catalog while the catch log is thin. */
export async function fetchWebResearch(options: {
  targetSpecies?: string;
  region?: string;
  month?: string;
}): Promise<WebResearch> {
  const query = [
    options.targetSpecies ?? 'bass',
    'fishing',
    options.region ?? 'Oklahoma',
    options.month ?? '',
    'patterns techniques conditions',
  ]
    .filter(Boolean)
    .join(' ');

  try {
    const result = await searchFishingInfo(query, 6_000);
    const search = result?.result ?? null;
    if (!search) {
      return {
        status: 'unavailable',
        query,
        summary: null,
        related: [],
        note: 'Search-derived research is unavailable right now.',
      };
    }

    const parts: string[] = [];
    if (search.answer) parts.push(search.answer);
    if (search.abstract) parts.push(search.abstract);
    const related = (search.related_topics ?? [])
      .filter((topic): topic is { text: string; url: string | null } => Boolean(topic?.text))
      .slice(0, 5)
      .map((topic) => ({ text: topic.text.slice(0, 300), url: topic.url }));

    const summary = parts.join(' ').trim() || null;
    return {
      status: summary || related.length > 0 ? 'ok' : 'empty',
      query,
      summary: summary ? summary.slice(0, 1200) : null,
      related,
      note:
        summary || related.length > 0
          ? 'Search-derived research (DuckDuckGo). Not a live or verified observation.'
          : 'Search returned no usable research for this query.',
    };
  } catch {
    return {
      status: 'unavailable',
      query,
      summary: null,
      related: [],
      note: 'Search-derived research is unavailable right now.',
    };
  }
}

function matchesSpecies(species: Species, target?: string): boolean {
  if (!target) return false;
  const needle = target.trim().toLowerCase();
  if (!needle) return false;
  return (
    species.name.toLowerCase() === needle ||
    species.id === needle.replace(/\s+/g, '-') ||
    species.name.toLowerCase().includes(needle) ||
    needle.includes(species.name.toLowerCase()) ||
    species.aliases.some((alias) => alias.toLowerCase() === needle)
  );
}

/** Stored catalog: nearby waters plus the species entries the analysis should be grounded in. */
export function buildCatalogContext(options: {
  lat: number;
  lng: number;
  targetSpecies?: string;
  saltwater?: boolean;
}): CatalogContext {
  const nearby_spots = DEFAULT_SPOTS
    .map((spot) => ({
      id: spot.id,
      name: spot.name,
      lat: spot.lat,
      lng: spot.lng,
      water_type: spot.water_type,
      spot_type: spot.spot_type,
      region: spot.region ?? null,
      distance_miles:
        Math.round(
          distanceMiles(
            { latitude: options.lat, longitude: options.lng },
            { latitude: spot.lat, longitude: spot.lng },
          ) * 10,
        ) / 10,
    }))
    .sort((a, b) => a.distance_miles - b.distance_miles)
    .slice(0, CATALOG_SPOT_LIMIT);

  const requested = SPECIES.filter((species) => matchesSpecies(species, options.targetSpecies));
  const habitat = options.saltwater ? 'Saltwater' : 'Freshwater';
  const fallback = SPECIES.filter((species) => species.habitat === habitat).slice(0, CATALOG_SPECIES_LIMIT);
  const selected = [...new Map([...requested, ...fallback].map((species) => [species.id, species])).values()]
    .slice(0, CATALOG_SPECIES_LIMIT);

  return {
    status: nearby_spots.length > 0 && selected.length > 0 ? 'ok' : 'unavailable',
    nearby_spots,
    species: selected.map((species) => ({
      id: species.id,
      name: species.name,
      scientific_name: species.scientificName,
      habitat: species.habitat,
      best_bait: species.bestBait,
      best_time: species.bestTime,
      depth: species.depth,
      tips: species.tips,
      opt_water_temp_f_min: cToF(species.advice.optTempMin),
      opt_water_temp_f_max: cToF(species.advice.optTempMax),
    })),
  };
}

function statusFor(
  id: SourceId,
  label: string,
  status: SourceState,
  mode: SourceStatus['mode'],
  note: string,
): SourceStatus {
  return { id, label, status, mode, note };
}

/** Gathers every analysis source in parallel; one slow source never blocks another. */
export async function gatherSmartAnalyticsSources(
  input: SmartAnalyticsInput,
  options: { supabase: SupabaseClient | null; userId?: string | null; authenticated: boolean },
): Promise<SmartAnalyticsSources> {
  const catalog = buildCatalogContext(input);
  const [provider, catchLog, community, history, web] = await Promise.all([
    fetchProviderConditions(input.lat, input.lng, input.saltwater === true),
    fetchCatchLogInsights(options.supabase, {
      userId: options.userId ?? null,
      lat: input.lat,
      lng: input.lng,
    }),
    fetchCommunityInsights(options.supabase, {
      authenticated: options.authenticated,
      lat: input.lat,
      lng: input.lng,
    }),
    fetchEnvironmentalHistory(options.supabase, { lat: input.lat, lng: input.lng }),
    fetchWebResearch({ targetSpecies: input.targetSpecies, region: input.region }),
  ]);

  const sources: SourceStatus[] = [
    statusFor(
      'provider-conditions',
      'Live provider conditions',
      provider.status,
      'provider',
      provider.status === 'ok'
        ? `Readings from ${provider.providers.join(', ')}.`
        : 'No provider readings answered; no readings were substituted.',
    ),
    statusFor('environmental-history', 'Stored environmental history', history.status, 'database', history.note),
    statusFor('spot-catalog', 'Stored spot catalog', catalog.status, 'local-catalog', `${catalog.nearby_spots.length} nearby waters in the stored catalog.`),
    statusFor('species-catalog', 'Stored species catalog', catalog.status, 'local-catalog', `${catalog.species.length} species entries supplied as biological grounding.`),
    statusFor('catch-log', 'Community catch log', catchLog.status, 'community', catchLog.note),
    statusFor('community-reports', 'Community reports', community.status, 'community', community.note),
    statusFor('web-search', 'Search-derived research', web.status, 'search-derived', web.note),
  ];

  return {
    sources,
    provider,
    catchLog,
    community,
    history,
    web,
    catalog,
    data_phase: catchLog.sufficient ? 'community' : 'bootstrap',
  };
}

function json(value: unknown): string {
  return JSON.stringify(value, null, 0);
}

/** Prompt given to Fishbot. Every supplied block is labeled with its source and state. */
export function buildAnalysisPrompt(input: {
  lat: number;
  lng: number;
  targetSpecies?: string;
  region?: string;
  sources: SmartAnalyticsSources;
  baseline: Array<{ spot_id: string; spot_name: string; score: number; species: string; reason: string }>;
}): string {
  const { sources } = input;
  const phaseNote =
    sources.data_phase === 'community'
      ? 'Community catch log: substantial enough to weight. Use it as evidence and say it is user-logged data.'
      : `Community catch log: still building (${sources.catchLog.total} logged, ${sources.catchLog.nearby} nearby). This is BOOTSTRAP mode — rely on provider readings, stored history, the catalog and search-derived research, and state that community catch evidence is not yet available in volume.`;

  return `You are Fishbot, the analysis engine for Fishfinder Pro. Produce a fishing analysis for latitude ${input.lat}, longitude ${input.lng}${input.targetSpecies ? ` targeting ${input.targetSpecies}` : ''}${input.region ? ` in ${input.region}` : ''}.

SOURCE INVENTORY (state of each input for this run)
${json(sources.sources.map(({ id, status, mode, note }) => ({ id, status, mode, note })))}

${phaseNote}

1. PROVIDER CONDITIONS (mode: provider) — ${sources.provider.status}
${json(sources.provider)}

2. STORED ENVIRONMENTAL HISTORY (mode: database) — ${sources.history.status}
${json(sources.history)}

3. STORED SPOT CATALOG (mode: local-catalog) — ${sources.catalog.status}
${json(sources.catalog.nearby_spots)}

4. STORED SPECIES CATALOG (mode: local-catalog) — use as biological grounding only
${json(sources.catalog.species)}

5. COMMUNITY CATCH LOG (mode: community) — ${sources.catchLog.status}
${json({
    total: sources.catchLog.total,
    nearby: sources.catchLog.nearby,
    recent_30d: sources.catchLog.recent_30d,
    top_species: sources.catchLog.top_species,
    top_baits: sources.catchLog.top_baits,
    sufficient: sources.catchLog.sufficient,
  })}

6. COMMUNITY REPORTS (mode: community) — ${sources.community.status}
${json(sources.community.nearby_reports)}

7. SEARCH-DERIVED RESEARCH (mode: search-derived) — ${sources.web.status}
Query: ${sources.web.query}
${sources.web.summary ?? '(no summary returned)'}
${json(sources.web.related)}

8. DETERMINISTIC CATALOG BASELINE (mode: deterministic) — scored locally, not measured
${json(input.baseline)}

RULES
- Only recommend waters that appear in the STORED SPOT CATALOG block, using the exact spot_id. Never invent a spot id.
- Never call a value live, current, verified or measured unless the provider block supplied it with a captured_at timestamp.
- Search-derived text is third-party research, not an observation at these coordinates. Label it that way in your reasoning.
- The deterministic baseline is a catalog comparison, not a measurement. Say when the AI ranking agrees or disagrees with it.
- If a source is "unavailable" or "empty", say what is missing in data_gaps instead of filling it in.
- Confidence must fall when sources are unavailable or the catch log is thin.
- Always use Fahrenheit. Never use Celsius or degrees C.

Respond with ONLY valid JSON:
{
  "verdict": "one or two sentences: what an angler should do here and how trustworthy this is",
  "confidence": 0,
  "reasoning": "three to five sentences comparing provider readings, stored history, catalog baseline, community data and search-derived research",
  "data_gaps": ["what is missing and why it matters"],
  "recommendations": [
    {
      "spot_id": "exact id from the catalog block",
      "spot_name": "exact name from the catalog block",
      "score": 0,
      "rating": "Hot|Good|Fair",
      "primary_species": ["species"],
      "best_time_today": "window or state unavailable",
      "best_technique": "technique",
      "recommended_lure": "lure or bait",
      "reason": "why, tied to the supplied sources"
    }
  ]
}
Return 1 to 6 recommendations ordered best first. confidence is an integer 0-100. score is an integer 0-100. Keep each field concise.`;
}
