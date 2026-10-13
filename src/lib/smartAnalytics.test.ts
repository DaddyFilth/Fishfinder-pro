import { describe, expect, it, vi, afterEach } from 'vitest';

vi.mock('./fetchers/environmental', () => ({
  fetchNWSConditions: vi.fn(async () => null),
  fetchPressureTrend: vi.fn(async () => null),
  fetchMarineConditions: vi.fn(async () => null),
}));

vi.mock('./webSearch', () => ({
  searchFishingInfo: vi.fn(async () => null),
  formatSearchSummary: vi.fn(() => ''),
}));

import {
  CATCH_LOG_SUFFICIENT_NEARBY,
  CATCH_LOG_SUFFICIENT_TOTAL,
  buildAnalysisPrompt,
  buildCatalogContext,
  fetchCatchLogInsights,
  fetchCommunityInsights,
  fetchProviderConditions,
  gatherSmartAnalyticsSources,
} from './smartAnalytics';

const OKC = { lat: 35.4676, lng: -97.5164 };

afterEach(() => {
  vi.clearAllMocks();
});

describe('smart analytics sources', () => {
  it('reports the catch log as unavailable instead of guessing when no database is configured', async () => {
    const insights = await fetchCatchLogInsights(null, OKC);

    expect(insights.status).toBe('unavailable');
    expect(insights.total).toBe(0);
    expect(insights.sufficient).toBe(false);
    expect(insights.note).toMatch(/not configured/i);
  });

  it('keeps community reports behind a signed-in account', async () => {
    const anonymous = await fetchCommunityInsights(null, { authenticated: false, ...OKC });
    expect(anonymous.status).toBe('unavailable');
    expect(anonymous.nearby_reports).toEqual([]);

    const signedInButUnconfigured = await fetchCommunityInsights(null, { authenticated: true, ...OKC });
    expect(signedInButUnconfigured.status).toBe('unavailable');
  });

  it('labels every provider as unavailable rather than substituting readings', async () => {
    const conditions = await fetchProviderConditions(OKC.lat, OKC.lng, false);

    expect(conditions.status).toBe('unavailable');
    expect(conditions.providers).toEqual([]);
    expect(conditions.air_temp_f).toBeNull();
    expect(conditions.fishing_score).toBeNull();
    expect(conditions.captured_at).toBeNull();
  });

  it('builds catalog context from the stored spot and species catalogs', () => {
    const catalog = buildCatalogContext(OKC);

    expect(catalog.status).toBe('ok');
    expect(catalog.nearby_spots.length).toBeGreaterThan(0);
    expect(catalog.nearby_spots[0].distance_miles).toBeGreaterThanOrEqual(0);
    expect(catalog.species.length).toBeGreaterThan(0);
    expect(catalog.species[0]).toHaveProperty('opt_water_temp_f_min');
  });

  it('gathers every source in parallel and stays in bootstrap mode while the catch log is thin', async () => {
    const sources = await gatherSmartAnalyticsSources(
      { ...OKC, targetSpecies: 'Largemouth Bass' },
      { supabase: null, authenticated: false },
    );

    expect(sources.data_phase).toBe('bootstrap');
    expect(sources.sources.map((row) => row.id)).toEqual(
      expect.arrayContaining([
        'provider-conditions',
        'environmental-history',
        'spot-catalog',
        'species-catalog',
        'catch-log',
        'community-reports',
        'web-search',
      ]),
    );
    expect(sources.catchLog.sufficient).toBe(false);
    expect(CATCH_LOG_SUFFICIENT_TOTAL).toBeGreaterThan(0);
    expect(CATCH_LOG_SUFFICIENT_NEARBY).toBeGreaterThan(0);
  });

  it('builds a prompt that carries the source inventory and bootstrap instruction', async () => {
    const sources = await gatherSmartAnalyticsSources(
      { ...OKC, targetSpecies: 'Largemouth Bass' },
      { supabase: null, authenticated: false },
    );

    const prompt = buildAnalysisPrompt({
      ...OKC,
      targetSpecies: 'Largemouth Bass',
      sources,
      baseline: [{ spot_id: 'abc', spot_name: 'Test Lake', score: 55, species: 'Largemouth Bass', reason: 'catalog baseline' }],
    });

    expect(prompt).toContain('BOOTSTRAP mode');
    expect(prompt).toContain('SOURCE INVENTORY');
    expect(prompt).toContain('"spot_id":"abc"');
    expect(prompt).toContain('Never invent a spot id');
    expect(prompt).toContain('Always use Fahrenheit');
  });
});
