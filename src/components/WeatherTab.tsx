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

const NWS_HEADERS = { Accept: 'application/geo+json' };

function validCoordinates(lat?: number, lng?: number) {
  return typeof lat === 'number' && typeof lng === 'number' &&
    Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function isNwsUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'api.weather.gov';
  } catch {
    return false;
  }
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
  const [periods, setPeriods] = useState<Period[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(() => validCoordinates(lat, lng));
  const [error, setError] = useState('');
  const [clock, setClock] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setClock(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!validCoordinates(lat, lng)) return;

    const controller = new AbortController();

    const load = async () => {
      await Promise.resolve();
      setLoading(true);
      setError('');
      try {
        const pointResponse = await fetch(
          `https://api.weather.gov/points/${lat!.toFixed(4)},${lng!.toFixed(4)}`,
          { headers: NWS_HEADERS, cache: 'no-store', signal: controller.signal },
        );
        if (!pointResponse.ok) throw new Error('NWS location lookup failed');
        const point = await pointResponse.json() as { properties?: { forecastHourly?: unknown } };
        if (!isNwsUrl(point.properties?.forecastHourly)) {
          throw new Error('NWS returned an invalid forecast URL');
        }

        const response = await fetch(point.properties.forecastHourly, {
          headers: NWS_HEADERS,
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('NWS forecast request failed');
        const payload = await response.json() as {
          properties?: { periods?: unknown[]; updateTime?: string; generatedAt?: string };
        };
        const next = Array.isArray(payload.properties?.periods)
          ? payload.properties.periods.filter(isPeriod)
          : [];
        if (!next.length) throw new Error('NWS returned no usable forecast periods');
        setPeriods(next);
        setUpdatedAt(payload.properties?.updateTime ?? payload.properties?.generatedAt ?? null);
      } catch (reason) {
        if (!controller.signal.aborted) {
          setPeriods([]);
          setError(reason instanceof Error ? reason.message : 'Unable to load NWS forecast');
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    void load();
    return () => controller.abort();
  }, [lat, lng]);

  if (!validCoordinates(lat, lng)) {
    return <p style={{ padding: 16, color: '#94a3b8', fontSize: 13 }}>Provider weather is unavailable until a spot or device location is selected.</p>;
  }
  if (loading) return <p style={{ padding: 16, color: '#60a5fa', fontSize: 12 }}>Loading NOAA/NWS forecast…</p>;
  if (error || !periods.length) {
    return <p role="alert" style={{ padding: 16, color: '#fca5a5', fontSize: 12 }}>{error || 'NWS forecast unavailable.'}</p>;
  }

  const current = periods.find((period) =>
    Date.parse(period.startTime) <= clock && clock < Date.parse(period.endTime),
  ) ?? periods[0];

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: '#060d1a', padding: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: '#22d3ee', marginBottom: 4 }}>Provider Weather</div>
      <div style={{ fontSize: 10, color: '#64748b', marginBottom: 4 }}>NOAA/NWS forecast{locationLabel ? ` · ${locationLabel}` : ''}</div>
      <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 14 }}>Forecast data, not a live observation. Updated {updatedAt ? new Date(updatedAt).toLocaleString() : 'time unavailable'}.</div>
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
          {periods.slice(0, 12).map((period) => (
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
