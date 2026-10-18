import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  getSupabaseAdmin,
  getAuthContext,
  fetchNWSConditions,
  fetchUSGSWaterData,
  fetchMarineConditions,
  fetchTideData,
} = vi.hoisted(() => ({
  getSupabaseAdmin: vi.fn(),
  getAuthContext: vi.fn(),
  fetchNWSConditions: vi.fn(),
  fetchUSGSWaterData: vi.fn(),
  fetchMarineConditions: vi.fn(),
  fetchTideData: vi.fn(),
}));

vi.mock('@/lib/security', () => ({
  enforceRateLimit: vi.fn(() => null),
}));

vi.mock('@/lib/auth/server', () => ({
  getAuthContext,
}));

vi.mock('@/lib/supabaseAdmin', () => ({
  getSupabaseAdmin,
}));

vi.mock('@/lib/fetchers/environmental', () => ({
  fetchNWSConditions,
  fetchUSGSWaterData,
  fetchMarineConditions,
  fetchTideData,
}));

import { GET } from './route';

const NWS_READING = {
  source: 'NOAA NWS',
  air_temp_c: 21.5,
  wind_speed_ms: 4.2,
  wind_direction: 'S',
  short_forecast: 'Sunny',
  is_daytime: true,
  period_name: 'Today',
};

function spotRow(id: string) {
  return {
    id,
    lat: 35.58,
    lng: -97.6,
    water_type: 'freshwater',
    usgs_site_id: null,
    noaa_station_id: null,
  };
}

/**
 * Minimal Supabase double covering the three chains this route uses: resolving a
 * spot, reading the newest snapshot, and inserting a new reading.
 */
function createSupabaseStub(options: {
  id: string;
  storedSnapshot?: Record<string, unknown> | null;
  insertError?: { message: string } | null;
}) {
  const insertedRows: Record<string, unknown>[] = [];

  return {
    insertedRows,
    from(table: string) {
      if (table === 'spots') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: spotRow(options.id),
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === 'environmental_snapshots') {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: () => ({
                  maybeSingle: async () => ({
                    data: options.storedSnapshot ?? null,
                    error: null,
                  }),
                }),
              }),
            }),
          }),
          insert: (row: Record<string, unknown>) => ({
            select: () => ({
              single: async () => {
                if (options.insertError) {
                  return { data: null, error: options.insertError };
                }
                insertedRows.push(row);
                return {
                  data: { ...row, id: 'snapshot-1', captured_at: new Date().toISOString() },
                  error: null,
                };
              },
            }),
          }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
  };
}

function recentSnapshot(id: string, overrides: Record<string, unknown> = {}) {
  return {
    spot_id: id,
    captured_at: new Date(Date.now() - 60_000).toISOString(),
    air_temp_c: 12.3,
    fishing_score: 55,
    data_mode: 'provider',
    data_sources: ['USGS Water Data'],
    ...overrides,
  };
}

function conditionsRequest(id: string) {
  return GET(
    new NextRequest(`https://example.com/api/spots/${id}/conditions`),
    { params: Promise.resolve({ id }) },
  );
}

describe('spot conditions route liveness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthContext.mockResolvedValue({ user: { id: 'user-1' }, role: 'angler' });
    fetchNWSConditions.mockResolvedValue(null);
    fetchUSGSWaterData.mockResolvedValue(null);
    fetchMarineConditions.mockResolvedValue(null);
    fetchTideData.mockResolvedValue(null);
  });

  it('rejects anonymous callers even though the proxy also guards this route', async () => {
    getAuthContext.mockResolvedValue(null);

    const response = await conditionsRequest('anonymous');

    expect(response.status).toBe(401);
  });

  it('fetches live provider readings even when a recent snapshot exists', async () => {
    const stub = createSupabaseStub({ id: 'lake-live', storedSnapshot: recentSnapshot('lake-live') });
    getSupabaseAdmin.mockReturnValue(stub);
    fetchNWSConditions.mockResolvedValue(NWS_READING);

    const response = await conditionsRequest('lake-live');
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data_mode).toBe('provider');
    expect(payload.air_temp_c).toBe(NWS_READING.air_temp_c);
    expect(payload.cached).toBe(false);
    // A snapshot this fresh is already stored; the live read must not duplicate it.
    expect(stub.insertedRows).toHaveLength(0);
  });

  it('stores the live reading when the newest snapshot is stale', async () => {
    const staleSnapshot = recentSnapshot('lake-store', {
      captured_at: new Date(Date.now() - 60 * 60_000).toISOString(),
    });
    const stub = createSupabaseStub({ id: 'lake-store', storedSnapshot: staleSnapshot });
    getSupabaseAdmin.mockReturnValue(stub);
    fetchNWSConditions.mockResolvedValue(NWS_READING);

    const response = await conditionsRequest('lake-store');
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data_mode).toBe('provider');
    expect(stub.insertedRows).toHaveLength(1);
    expect(stub.insertedRows[0]).toMatchObject({
      spot_id: 'lake-store',
      air_temp_c: NWS_READING.air_temp_c,
    });
  });

  it('falls back to a recent snapshot when every provider is unavailable', async () => {
    getSupabaseAdmin.mockReturnValue(
      createSupabaseStub({ id: 'lake-fallback', storedSnapshot: recentSnapshot('lake-fallback') }),
    );

    const response = await conditionsRequest('lake-fallback');
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data_mode).toBe('cached');
    expect(payload.cached).toBe(true);
    expect(payload.air_temp_c).toBe(12.3);
    expect(String(payload.warning)).toContain('Live provider readings are unavailable');
  });

  it('reports conditions as unavailable when providers fail and only a fallback row exists', async () => {
    getSupabaseAdmin.mockReturnValue(
      createSupabaseStub({
        id: 'lake-degraded',
        storedSnapshot: recentSnapshot('lake-degraded', {
          data_mode: 'fallback',
          data_sources: ['fallback'],
        }),
      }),
    );

    const response = await conditionsRequest('lake-degraded');
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload.data_mode).toBe('unavailable');
    expect(payload.live).toBe(false);
  });
});
