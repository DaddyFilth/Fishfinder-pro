export interface ScoringInput {
  air_temp_c?: number | null;
  water_temp_c?: number | null;
  pressure_hpa?: number | null;
  wind_speed_ms?: number | null;
  wave_height_m?: number | null;
  dissolved_oxygen_mgl?: number | null;
  flow_rate_cfs?: number | null;
  tide_type?: 'high' | 'low' | 'rising' | 'falling' | 'slack' | null;
  is_daytime?: boolean;
}

export interface ScoreBreakdown {
  total: number;
  components: { temperature: number; pressure: number; oxygen: number; wind: number; wave: number; tide: number; time: number };
  recommendations: string[];
  warnings: string[];
}

export function calculateFishingScore(input: ScoringInput): ScoreBreakdown {
  const components = {
    temperature: scoreTemperature(input.water_temp_c ?? input.air_temp_c),
    pressure:    scorePressure(input.pressure_hpa),
    oxygen:      scoreOxygen(input.dissolved_oxygen_mgl),
    wind:        scoreWind(input.wind_speed_ms),
    wave:        scoreWaves(input.wave_height_m),
    tide:        scoreTide(input.tide_type),
    time:        scoreTime(input.is_daytime),
  };
  const weights = { temperature: 0.25, pressure: 0.20, oxygen: 0.15, wind: 0.10, wave: 0.05, tide: 0.15, time: 0.10 };
  const total = Math.round(
    Object.entries(components).reduce((sum, [k, v]) => sum + v * weights[k as keyof typeof weights], 0)
  );
  const recommendations: string[] = [];
  const warnings: string[] = [];
  if (components.temperature < 30) warnings.push('Water temp outside optimal range for most species');
  if (components.oxygen < 40)      warnings.push('Low dissolved oxygen — fish likely holding deep');
  if (components.pressure < 40)    warnings.push('Unstable pressure — feeding activity suppressed');
  if (components.wind < 35)        warnings.push('High winds — unsafe boating conditions');
  if (components.tide === 85)      recommendations.push('Incoming tide — target channel edges and grass lines');
  if (components.tide === 80)      recommendations.push('Falling tide — fish staging near drop-offs');
  if (components.oxygen >= 75)     recommendations.push('Good dissolved oxygen — fish active throughout water column');
  if (components.pressure >= 75)   recommendations.push('Stable high pressure — consistent feeding expected');
  return { total, components, recommendations, warnings };
}

function scoreTemperature(t: number | null | undefined): number {
  if (t == null) return 50;
  if (t >= 15 && t <= 25) return 90;
  if (t >= 10 && t < 15)  return 70;
  if (t > 25 && t <= 30)  return 60;
  if (t < 5 || t > 35)    return 15;
  return 40;
}
function scorePressure(hpa: number | null | undefined): number {
  if (hpa == null) return 50;
  if (hpa >= 1010 && hpa <= 1025) return 85;
  if (hpa > 1005 && hpa < 1010)  return 70;
  if (hpa >= 1025 && hpa <= 1035) return 75;
  if (hpa < 1000) return 25;
  return 55;
}
function scoreOxygen(do_mgl: number | null | undefined): number {
  if (do_mgl == null) return 50;
  if (do_mgl >= 7) return 95;
  if (do_mgl >= 5) return 75;
  if (do_mgl >= 4) return 50;
  if (do_mgl < 3)  return 5;
  return 30;
}
function scoreWind(ms: number | null | undefined): number {
  if (ms == null) return 60;
  if (ms <= 3)  return 75;
  if (ms <= 6)  return 85;
  if (ms <= 10) return 60;
  if (ms <= 15) return 35;
  return 10;
}
function scoreWaves(h: number | null | undefined): number {
  if (h == null) return 65;
  if (h <= 0.5) return 90;
  if (h <= 1.0) return 75;
  if (h <= 1.5) return 50;
  if (h <= 2.5) return 25;
  return 5;
}
function scoreTide(tide: string | null | undefined): number {
  if (!tide) return 55;
  return ({ rising: 85, falling: 80, high: 65, slack: 50, low: 40 } as Record<string,number>)[tide] ?? 55;
}
function scoreTime(isDaytime: boolean | undefined): number {
  if (isDaytime === undefined) return 60;
  return isDaytime ? 60 : 75;
}
