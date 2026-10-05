/**
 * Shared client for `/api/spots/[id]/conditions`.
 *
 * The map popup and the score/ranking lists both ask for the same spot
 * conditions, so every request goes through this module: identical ids share one
 * in-flight call, responses are reused for a few minutes, concurrency is capped,
 * and rate-limit responses back off instead of being retried in a loop.
 */

export interface SpotConditionsQuery {
  id: string;
  lat?: number;
  lng?: number;
  water_type?: string;
  usgs_site_id?: string | null;
  noaa_station_id?: string | null;
}

export type SpotConditionsResult =
  | { ok: true; status: number; data: Record<string, unknown> }
  | { ok: false; status: number; message: string; retryAfterMs: number };

const MAX_CONCURRENT_REQUESTS = 5;
const SUCCESS_TTL_MS = 5 * 60_000;
const FAILURE_TTL_MS = 30_000;
const MAX_BACKOFF_MS = 60_000;
const RETRYABLE_BACKOFF_MS = 2_000;

const successes = new Map<string, { at: number; result: SpotConditionsResult }>();
const failures = new Map<string, { retryAt: number; result: SpotConditionsResult }>();
const inflight = new Map<string, Promise<SpotConditionsResult>>();

let activeRequests = 0;
const waiters: Array<() => void> = [];

function acquireSlot(): Promise<void> {
  if (activeRequests < MAX_CONCURRENT_REQUESTS) {
    activeRequests += 1;
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    waiters.push(() => {
      activeRequests += 1;
      resolve();
    });
  });
}

function releaseSlot() {
  activeRequests = Math.max(0, activeRequests - 1);
  const next = waiters.shift();
  if (next) next();
}

function parseRetryAfter(header: string | null): number {
  if (!header) return 15_000;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const date = Date.parse(header);
  if (Number.isFinite(date)) return Math.max(0, date - Date.now());
  return 15_000;
}

function failureMessage(status: number, fallback: string): string {
  if (status === 429) return 'Rate limited — try again in a moment.';
  if (status === 404) return 'Spot details are unavailable.';
  if (status === 400) return 'This spot could not be read.';
  if (status >= 500) return 'Conditions service is temporarily unavailable.';
  return fallback;
}

function buildUrl(spot: SpotConditionsQuery): string {
  const params = new URLSearchParams();

  if (Number.isFinite(spot.lat) && Number.isFinite(spot.lng)) {
    params.set('lat', String(spot.lat));
    params.set('lng', String(spot.lng));
  }
  if (spot.water_type === 'freshwater' || spot.water_type === 'saltwater') {
    params.set('water_type', spot.water_type);
  }
  if (spot.usgs_site_id) params.set('usgs', spot.usgs_site_id);
  if (spot.noaa_station_id) params.set('noaa', spot.noaa_station_id);

  const query = params.toString();
  return `/api/spots/${encodeURIComponent(spot.id)}/conditions${query ? `?${query}` : ''}`;
}

function rememberFailure(id: string, result: SpotConditionsResult & { ok: false }, retryAfterMs: number) {
  failures.set(id, {
    retryAt: Date.now() + Math.min(Math.max(retryAfterMs, FAILURE_TTL_MS), MAX_BACKOFF_MS),
    result,
  });
}

async function requestOnce(spot: SpotConditionsQuery): Promise<SpotConditionsResult> {
  const res = await fetch(buildUrl(spot), {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });

  if (res.ok) {
    const data = (await res.json()) as Record<string, unknown>;
    return { ok: true, status: res.status, data };
  }

  const retryAfterMs = parseRetryAfter(res.headers.get('Retry-After'));
  let message = failureMessage(res.status, `HTTP ${res.status}`);
  // Rate limits keep the friendlier wording; other errors surface the API copy.
  if (res.status !== 429) {
    try {
      const body = (await res.json()) as { error?: unknown };
      if (typeof body.error === 'string' && body.error.trim()) message = body.error;
    } catch {
      // Non-JSON error body; keep the status based message.
    }
  }

  return { ok: false, status: res.status, message, retryAfterMs };
}

async function run(spot: SpotConditionsQuery): Promise<SpotConditionsResult> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    const offline: SpotConditionsResult = {
      ok: false,
      status: 0,
      message: 'Offline — conditions will load when the connection returns.',
      retryAfterMs: 0,
    };
    return offline;
  }

  await acquireSlot();
  try {
    let result = await requestOnce(spot);

    // A short rate-limit wait is cheaper than surfacing an error for a burst.
    if (!result.ok && result.status === 429) {
      const backoffMs = result.retryAfterMs;
      if (backoffMs >= 0 && backoffMs <= RETRYABLE_BACKOFF_MS) {
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
        result = await requestOnce(spot);
      }
    }

    if (result.ok) {
      successes.set(spot.id, { at: Date.now(), result });
      failures.delete(spot.id);
    } else {
      rememberFailure(spot.id, result, result.retryAfterMs || FAILURE_TTL_MS);
    }

    return result;
  } catch (error) {
    const result: SpotConditionsResult = {
      ok: false,
      status: 0,
      message: error instanceof Error && error.message ? error.message : 'Network error.',
      retryAfterMs: FAILURE_TTL_MS,
    };
    rememberFailure(spot.id, result, FAILURE_TTL_MS);
    return result;
  } finally {
    releaseSlot();
  }
}

export function fetchSpotConditions(
  spot: SpotConditionsQuery,
  options: { force?: boolean } = {},
): Promise<SpotConditionsResult> {
  if (!spot.id) {
    return Promise.resolve({
      ok: false,
      status: 400,
      message: 'Missing spot id.',
      retryAfterMs: 0,
    });
  }

  const now = Date.now();

  if (options.force) {
    successes.delete(spot.id);
    failures.delete(spot.id);
  } else {
    const success = successes.get(spot.id);
    if (success && now - success.at < SUCCESS_TTL_MS) return Promise.resolve(success.result);

    const failure = failures.get(spot.id);
    if (failure && now < failure.retryAt) return Promise.resolve(failure.result);
  }

  const pending = inflight.get(spot.id);
  if (pending) return pending;

  const task = run(spot).finally(() => {
    inflight.delete(spot.id);
  });
  inflight.set(spot.id, task);
  return task;
}

/** Drops cached responses; used by auto-refresh so scores are recomputed. */
export function resetSpotConditionsCache() {
  successes.clear();
  failures.clear();
}
