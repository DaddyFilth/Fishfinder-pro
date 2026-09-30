import { openDB } from 'idb';
import { SolunarData, BarometricTrend, SOLUNAR_STORE, BARO_STORE } from './types';

export class EnvironmentManager {
  private static dbPromise = typeof window === 'undefined' ? Promise.reject(new Error('IndexedDB is only available in the browser')) : openDB('fishfinder-env', 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(SOLUNAR_STORE)) {
        db.createObjectStore(SOLUNAR_STORE, { keyPath: 'date' });
      }
      if (!db.objectStoreNames.contains(BARO_STORE)) {
        db.createObjectStore(BARO_STORE, { keyPath: 'timestamp' });
      }
    },
  });

  static async getSolunarData(date: string): Promise<SolunarData> {
    const db = await this.dbPromise;
    const cached = await db.get(SOLUNAR_STORE, date);
    
    if (cached) return cached as SolunarData;

    // Simulated solunar calculation (In production, this would call a specialized API)
    const data: SolunarData = {
      date,
      majorPeriod: { start: '08:00', end: '11:00' },
      minorPeriod: { start: '16:00', end: '18:00' },
      moonPhase: 'Waxing Gibbous',
      moonIllumination: 75,
      isPrimeWindow: true,
    };

    await db.put(SOLUNAR_STORE, data);
    return data;
  }

  static async getBarometricTrend(pressure: number): Promise<BarometricTrend> {
    const db = await this.dbPromise;
    const history = await db.getAll(BARO_STORE);
    
    const lastEntry = history[history.length - 1];
    let trend: 'rising' | 'falling' | 'stable' = 'stable';
    let impact: 'positive' | 'negative' | 'neutral' = 'neutral';
    let advice = 'Conditions are steady.';

    if (lastEntry) {
      const diff = pressure - lastEntry.currentPressure;
      if (diff < -1.0) {
        trend = 'falling';
        impact = 'positive';
        advice = 'Pressure is dropping rapidly! Big bites are likely as fish feed before the storm.';
      } else if (diff > 1.0) {
        trend = 'rising';
        impact = 'negative';
        advice = 'Pressure is rising. Fish may move deeper and become lethargic.';
      }
    }

    const entry: BarometricTrend = {
      currentPressure: pressure,
      trend,
      impact,
      advice,
    };

    await db.put(BARO_STORE, entry);
    return entry;
  }
}
