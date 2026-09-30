export interface SolunarData {
  date: string;
  majorPeriod: { start: string; end: string };
  minorPeriod: { start: string; end: string };
  moonPhase: string;
  moonIllumination: number;
  isPrimeWindow: boolean;
}

export interface BarometricTrend {
  timestamp: number;
  currentPressure: number;
  trend: 'rising' | 'falling' | 'stable';
  impact: 'positive' | 'negative' | 'neutral';
  advice: string;
}

export const SOLUNAR_STORE = 'user_solunar_cache';
export const BARO_STORE = 'user_baro_cache';
