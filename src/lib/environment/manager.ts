import { SolunarData, BarometricTrend } from './types';
import { calculateSolunar } from '../scoring/solunar';
import { fetchPressureTrend } from '../fetchers/environmental';

const DEFAULT_CENTER = { lat: 35, lng: -97.366 };

export class EnvironmentManager {
  private static cache = new Map<string, { expiresAt: number; value: unknown }>();
  private static readonly TTL_MS = 10 * 60 * 1000;

  static async getSolunarData(date: string, lat: number = DEFAULT_CENTER.lat): Promise<SolunarData> {
    const key = `solunar:${date}:${lat}`;
    const cached = this.read<SolunarData>(key);
    if (cached) return cached;

    const solunar = calculateSolunar(new Date(date), lat);
    const data: SolunarData = {
      date,
      majorPeriod: solunar.majorPeriods[0],
      minorPeriod: solunar.minorPeriods[0],
      moonPhase: solunar.moonPhaseName,
      moonIllumination: solunar.moonIllumination,
      isPrimeWindow: solunar.solunarScore >= 60,
    };

    this.write(key, data);
    return data;
  }

  static async getBarometricTrend(lat: number = DEFAULT_CENTER.lat, lng: number = DEFAULT_CENTER.lng): Promise<BarometricTrend> {
    const key = `baro:${lat}:${lng}`;
    const cached = this.read<BarometricTrend>(key);
    if (cached) return cached;

    const trendData = await fetchPressureTrend(lat, lng);

    if (!trendData || trendData.currentPressure === null) {
      return {
        currentPressure: 0,
        trend: 'stable',
        impact: 'neutral',
        advice: 'Pressure data is unavailable at this location right now.',
      };
    }

    const impact =
      trendData.trend === 'falling' ? 'positive' : trendData.trend === 'rising' ? 'negative' : 'neutral';
    const advice =
      trendData.trend === 'falling'
        ? 'Pressure is dropping. Baitfish activity increases ahead of incoming weather.'
        : trendData.trend === 'rising'
          ? 'Pressure is rising. Feeding can tighten as the bite rebuilds after the weather change.'
          : 'Pressure is steady. Conditions remain typical for the season.';

    const result: BarometricTrend = {
      currentPressure: Math.round(trendData.currentPressure * 10) / 10,
      trend: trendData.trend,
      impact,
      advice,
    };

    this.write(key, result);
    return result;
  }

  private static read<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry || entry.expiresAt <= Date.now()) {
      this.cache.delete(key);
      return null;
    }
    return entry.value as T;
  }

  private static write(key: string, value: unknown) {
    this.cache.set(key, { expiresAt: Date.now() + this.TTL_MS, value });
  }
}
