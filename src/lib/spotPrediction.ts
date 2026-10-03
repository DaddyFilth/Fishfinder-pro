import type { Spot } from '@/lib/mapFilters';
import {
  SPECIES,
  biteRateFor,
  deriveFishingCondition,
  spotTargetsFor,
  type FishingCondition,
} from '@/lib/speciesCatalog';

export interface SpotPredictionConditions {
  air_temp_c?: number | null;
  water_temp_c?: number | null;
  wind_speed_ms?: number | null;
  pressure_hpa?: number | null;
  water_level_m?: number | null;
  flow_rate_cfs?: number | null;
  fishing_score?: number | null;
  bite_score?: number | null;
  data_mode?: string;
  captured_at?: string | null;
}

export interface SpotPrediction {
  score: number | null;
  scoreLabel: string;
  sourceLabel: string;
  condition: FishingCondition | null;
  species: string;
  speciesId: string;
  bait: string;
  location: string;
  depth: string;
  seasonalOutlook: string;
  inputs: string[];
}

function scoreLabel(score: number | null): string {
  if (score === null) return 'Waiting for conditions';
  if (score >= 75) return 'Prime window';
  if (score >= 50) return 'Good window';
  if (score >= 25) return 'Fair window';
  return 'Slow window';
}

function seasonForMonth(month: number): string {
  if (month >= 2 && month <= 4) return 'Spring';
  if (month >= 5 && month <= 7) return 'Summer';
  if (month >= 8 && month <= 10) return 'Fall';
  return 'Winter';
}

function seasonalIndex(activity: readonly number[], month: number): number {
  const peak = Math.max(...activity);
  return Math.round((activity[month] / Math.max(peak, 1)) * 100);
}

function waterDepthLabel(conditions: SpotPredictionConditions, condition: FishingCondition): string {
  if (typeof conditions.water_level_m === 'number' && Number.isFinite(conditions.water_level_m)) {
    const level = conditions.water_level_m;
    return level < 0.9 ? 'shallow edges and cover' : level < 2.4 ? 'mid-depth breaks and structure' : 'deep channel edges and bottom structure';
  }
  if (typeof conditions.flow_rate_cfs === 'number' && Number.isFinite(conditions.flow_rate_cfs)) {
    return conditions.flow_rate_cfs >= 1000 ? 'current seams and protected eddies' : 'holes and slower current edges';
  }
  return condition === 'cool' ? 'deeper structure and channel swings' : 'shallow cover, points, and active edges';
}

function speciesForSpot(spot: Spot): typeof SPECIES[number][] {
  const text = `${spot.spot_type} ${spot.notes ?? ''} ${spot.description ?? ''}`.toLowerCase();
  const preferredGroups = text.includes('trout')
    ? ['Trout']
    : text.includes('river') || text.includes('stream')
      ? ['Catfish', 'Bass', 'Panfish']
      : text.includes('reservoir')
        ? ['Bass', 'Walleye', 'Catfish']
        : ['Bass', 'Panfish', 'Catfish'];
  return SPECIES.filter((species) => preferredGroups.includes(species.group));
}

/**
 * Produces the explainable annual/current prediction shown inside one spot's
 * detail view. It never invents a measurement: missing provider inputs remain
 * explicitly unavailable, while catalog biology supplies planning guidance.
 */
export function buildSpotPrediction(
  spot: Spot,
  conditions: SpotPredictionConditions | null | undefined,
  date = new Date(),
): SpotPrediction | null {
  if (!conditions) return null;
  const condition = deriveFishingCondition(conditions) ?? 'stable';
  const month = date.getMonth();
  const season = seasonForMonth(month);
  const candidates = speciesForSpot(spot);
  if (candidates.length === 0) return null;

  const ranked = candidates
    .map((species) => ({
      species,
      currentRate: biteRateFor(species, condition),
      annualRate: seasonalIndex(species.activity, month),
    }))
    .sort((a, b) => (b.currentRate + b.annualRate) - (a.currentRate + a.annualRate));
  const best = ranked[0];
  const scoreValues = [best.currentRate, best.annualRate];
  if (typeof conditions.bite_score === 'number' && Number.isFinite(conditions.bite_score)) scoreValues.push(conditions.bite_score);
  else if (typeof conditions.fishing_score === 'number' && Number.isFinite(conditions.fishing_score)) scoreValues.push(conditions.fishing_score);
  const score = Math.round(scoreValues.reduce((sum, value) => sum + value, 0) / scoreValues.length);
  const depth = waterDepthLabel(conditions, condition);
  const targets = spotTargetsFor(best.species, condition).slice(0, 2).join(' and ');
  const warmWater = typeof conditions.water_temp_c === 'number' && conditions.water_temp_c >= best.species.advice.optTempMin;
  const bait = (warmWater ? best.species.advice.baitsWarm : best.species.advice.baitsCold)[0] ?? best.species.bestBait[0] ?? 'Use the species catalog bait list';
  const inputLabels = [
    typeof conditions.water_temp_c === 'number' ? `water ${(conditions.water_temp_c * 9 / 5 + 32).toFixed(1)}°F` : 'water temperature unavailable',
    typeof conditions.air_temp_c === 'number' ? `air ${(conditions.air_temp_c * 9 / 5 + 32).toFixed(1)}°F` : 'weather snapshot unavailable',
    typeof conditions.water_level_m === 'number' ? `depth/level ${conditions.water_level_m.toFixed(2)} m` : typeof conditions.flow_rate_cfs === 'number' ? `flow ${conditions.flow_rate_cfs.toFixed(0)} cfs` : 'depth/flow unavailable',
  ];

  return {
    score,
    scoreLabel: scoreLabel(score),
    sourceLabel: conditions.data_mode === 'provider' ? 'AI + provider conditions' : 'Catalog planning estimate',
    condition,
    species: best.species.name,
    speciesId: best.species.id,
    bait,
    location: `${targets || 'structure and active water'}; ${depth}`,
    depth: warmWater ? best.species.advice.depthWarm : best.species.advice.depthCold,
    seasonalOutlook: `${season} annual pattern: ${best.annualRate}/100 activity for ${best.species.name}.`,
    inputs: inputLabels,
  };
}
