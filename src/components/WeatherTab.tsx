'use client';

import { useEffect, useState } from 'react';

type Props = { lat?: number; lng?: number; locationLabel?: string };
type Period = {
  startTime: string;
  endTime: string;
  temperature: number;
  temperatureUnit: string;
  windSpeed: string;
  windDirection: string;
  shortForecast: string;
};

/** Forecast payload plus the coordinates it belongs to, so a stale location is never shown. */
type Forecast = {
  key: string;
  periods: Period[];
  updatedAt: string | null;
};

type ForecastError = {
  key: string;
  message: string;
};

const NWS_HEADERS = { Accept: 'application/geo+json' };

/**
 * How often an open Weather tab re-asks for the hourly forecast. NWS refreshes its hourly
 * periods about once an hour, so five minutes keeps the tab visibly current without
 * hammering the provider.
 */
const REFRESH_INTERVAL_MS = 5 * 60_000;

function validCoordinates(lat?: number, lng?: number) {
  return typeof lat === 'number' && typeof lng === 'number' &&
    Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function isPeriod(value: unknown): value is Period {
  if (!value || typeof value !== 'object') return false;
  const period = value as Partial<Period>;
  return typeof period.startTime === 'string' && typeof period.endTime === 'string' &&
    typeof period.temperature === 'number' && Number.isFinite(period.temperature) &&
    typeof period.temperatureUnit === 'string' && typeof period.windSpeed === 'string' &&
    typeof period.windDirection === 'string' && typeof period.shortForecast === 'string';
}

function displayTemperature(period: Period) {
  const fahrenheit = period.temperatureUnit === 'C' ? period.temperature * 9 / 5 + 32 : period.temperature;
  return `${Math.round(fahrenheit)}°F`;
}

function displayHour(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Unknown'
    : date.toLocaleTimeString('en-US', { hour: 'numeric' });
}

function weatherIcon(forecast: string) {
  const text = forecast.toLowerCase();
  if (text.includes('thunder')) return '⛈';
  if (text.includes('rain') || text.includes('shower')) return '🌧';
  if (text.includes('snow')) return '❄️';
  if (text.includes('cloud')) return '☁️';
  if (text.includes('wind')) return '💨';
  return '☀️';
}

export default function WeatherTab({ lat, lng, locationLabel }: Props) {
  const locationKey = validCoordinates(lat, lng) ? `${lat},${lng}` : null;
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [refreshingKey, setRefreshingKey] = useState<string | null>(null);
  const [error, setError] = useState<ForecastError | null>(null);

  useEffect(() => {
    if (!locationKey) return;

    const controller = new AbortController();
    // The first load shows the placeholder; later polls update the forecast in place and
    // a failed poll keeps the last forecast on screen.
    let hasForecast = false;
    let inFlight = false;

    const load = async () => {
      if (inFlight) return;
      inFlight = true;

      try {
        const response = await fetch(
          `/api/weather?lat=${encodeURIComponent(lat!)}&lng=${encodeURIComponent(lng!)}`,
          { headers: NWS_HEADERS, cache: 'no-store', signal: controller.signal },
        );
        if (!response.ok) throw new Error('NOAA/NWS forecast request failed');
        const payload = await response.json() as {
          periods?: unknown[];
          updatedAt?: string;
        };
        const next = Array.isArray(payload.periods)
          ? payload.periods.filter(isPeriod)
          : [];
        if (!next.length) throw new Error('NWS returned no usable forecast periods');
        hasForecast = true;
        setForecast({ key: locationKey, periods: next, updatedAt: payload.updatedAt ?? null });
        setError(null);
      } catch (reason) {
        if (!controller.signal.aborted) {
          setError({
            key: locationKey,
            message: reason instanceof Error ? reason.message : 'Unable to load NWS forecast',
          });
        }
      } finally {
        inFlight = false;
        if (!controller.signal.aborted) setRefreshingKey(null);
      }
    };

    // Poll only while the tab is on screen and the device reports a connection; coming
    // back to the tab or regaining signal refreshes right away instead of waiting.
    const refreshIfCurrent = () => {
      if (document.visibilityState !== 'visible' || navigator.onLine === false) return;
      if (hasForecast) setRefreshingKey(locationKey);
      void load();
    };

    void load();
    const intervalId = window.setInterval(refreshIfCurrent, REFRESH_INTERVAL_MS);
    document.addEventListener('visibilitychange', refreshIfCurrent);
    window.addEventListener('online', refreshIfCurrent);

    return () => {
      controller.abort();
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', refreshIfCurrent);
      window.removeEventListener('online', refreshIfCurrent);
    };
  }, [lat, lng, locationKey]);

  if (!locationKey) {
    return <p style={{ padding: 16, color: '#94a3b8', fontSize: 13 }}>Provider weather is unavailable until a spot or device location is selected.</p>;
  }

  const currentForecast = forecast?.key === locationKey ? forecast : null;
  const currentError = error?.key === locationKey ? error.message : '';
  const refreshing = refreshingKey === locationKey && currentForecast !== null;

  if (!currentForecast) {
    return currentError
      ? <p role="alert" style={{ padding: 16, color: '#fca5a5', fontSize: 12 }}>{currentError}</p>
      : <p style={{ padding: 16, color: '#60a5fa', fontSize: 12 }}>Loading NOAA/NWS forecast…</p>;
  }

  const current = currentForecast.periods[0];

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: '#060d1a', padding: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: '#22d3ee', marginBottom: 4 }}>Provider Weather</div>
      <div style={{ fontSize: 10, color: '#64748b', marginBottom: 4 }}>NOAA/NWS forecast{locationLabel ? ` · ${locationLabel}` : ''}</div>
      <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 14 }}>
        Forecast data, not a live observation. Updated {currentForecast.updatedAt ? new Date(currentForecast.updatedAt).toLocaleString() : 'time unavailable'}{refreshing ? ' · refreshing…' : ''}.
      </div>
      {currentError && (
        <div role="status" style={{ marginBottom: 12, padding: '8px 10px', borderRadius: 8, background: 'rgba(120,53,15,0.35)', border: '1px solid #92400e', color: '#fde68a', fontSize: 11 }}>
          Refresh failed ({currentError}). Showing the last forecast.
        </div>
      )}
      <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: 14, marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ fontSize: 32, fontWeight: 800, color: '#e2e8f0' }}>{displayTemperature(current)}</div>
            <div style={{ fontSize: 12, color: '#cbd5e1' }}>{current.shortForecast}</div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{current.windSpeed} {current.windDirection}</div>
          </div>
          <div style={{ fontSize: 42 }}>{weatherIcon(current.shortForecast)}</div>
        </div>
      </div>
      <div style={{ background: '#0a0f1e', border: '1px solid #1e293b', borderRadius: 12, padding: 14 }}>
        <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700, marginBottom: 10 }}>NWS HOURLY FORECAST</div>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
          {currentForecast.periods.slice(0, 12).map((period) => (
            <div key={period.startTime} style={{ flexShrink: 0, background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, padding: 8, textAlign: 'center', minWidth: 66 }}>
              <div style={{ fontSize: 9, color: '#94a3b8' }}>{displayHour(period.startTime)}</div>
              <div style={{ fontSize: 18, margin: '4px 0' }}>{weatherIcon(period.shortForecast)}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#e2e8f0' }}>{displayTemperature(period)}</div>
              <div style={{ fontSize: 9, color: '#64748b' }}>{period.shortForecast}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
