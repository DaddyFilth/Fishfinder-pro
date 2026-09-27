'use client';

import { useEffect, useState } from 'react';
import { CloudSun, Droplets, RefreshCw, Wind } from 'lucide-react';

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
    return <div style={{ padding: 20, color: '#94a3b8', fontSize: 13 }}>Select a spot to see live NOAA weather.</div>;
  }
  if (loading) return <div className="weather-card-enter" style={{ padding: 20, color: '#7dd3fc', fontSize: 12 }}><RefreshCw size={15} className="weather-icon-float" style={{ verticalAlign: 'middle', marginRight: 8 }} />Reading NOAA forecast…</div>;
  if (error || !periods.length) {
    return <div role="alert" style={{ padding: 20, color: '#fca5a5', fontSize: 12 }}>Live NOAA weather is unavailable right now. No estimated data is shown.</div>;
  }

  const current = periods.find((period) =>
    Date.parse(period.startTime) <= clock && clock < Date.parse(period.endTime),
  ) ?? periods[0];

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: 'linear-gradient(180deg, #071827 0%, #060d1a 48%)', padding: 16 }}>
      <div className="weather-card-enter" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <CloudSun size={22} color="#67e8f9" aria-hidden="true" />
        <div style={{ fontSize: 16, fontWeight: 800, color: '#e2f7ff' }}>Live conditions</div>
      </div>
      <div style={{ fontSize: 11, color: '#7dd3fc', marginBottom: 5 }}>NOAA/NWS forecast{locationLabel ? ` · ${locationLabel}` : ''}</div>
      <div style={{ fontSize: 10, color: '#78909c', marginBottom: 14 }}>Forecast data, not a live observation · Updated {updatedAt ? new Date(updatedAt).toLocaleString() : 'recently'}</div>
      <div className="weather-card-enter" style={{ background: 'linear-gradient(135deg, #12334a, #0c1b2a)', border: '1px solid #24536a', borderRadius: 16, padding: 18, marginBottom: 12, boxShadow: '0 14px 32px rgba(0,0,0,.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
          <div><div style={{ fontSize: 42, lineHeight: 1, fontWeight: 850, color: '#f0f9ff' }}>{displayTemperature(current)}</div><div style={{ fontSize: 13, color: '#d5f3ff', marginTop: 8 }}>{current.shortForecast}</div></div>
          <div className="weather-icon-float" style={{ color: '#a5f3fc' }} aria-hidden="true"><CloudSun size={58} strokeWidth={1.4} /></div>
        </div>
        <div style={{ display: 'flex', gap: 14, marginTop: 18, color: '#a9d8e9', fontSize: 11 }}><span><Wind size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />{current.windSpeed} {current.windDirection}</span><span><Droplets size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />NOAA data</span></div>
      </div>
      <div style={{ background: '#09131f', border: '1px solid #1c3442', borderRadius: 14, padding: 14 }}>
        <div style={{ fontSize: 10, color: '#7dd3fc', fontWeight: 800, letterSpacing: '.08em', marginBottom: 10 }}>NEXT 12 HOURS</div>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
          {periods.slice(0, 12).map((period) => (<div key={period.startTime} style={{ flexShrink: 0, background: '#0d1c29', border: '1px solid #1d3a49', borderRadius: 10, padding: 9, textAlign: 'center', minWidth: 72 }}><div style={{ fontSize: 9, color: '#8fb2c0' }}>{displayHour(period.startTime)}</div><div style={{ color: '#a5f3fc', margin: '6px 0' }} aria-hidden="true"><CloudSun size={19} /></div><div style={{ fontSize: 12, fontWeight: 800, color: '#e2e8f0' }}>{displayTemperature(period)}</div><div style={{ fontSize: 9, color: '#78909c', marginTop: 4, whiteSpace: 'normal' }}>{period.shortForecast}</div></div>))}
        </div>
      </div>
    </div>
  );
}
