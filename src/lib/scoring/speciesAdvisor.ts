import { findSpecies } from '@/lib/speciesCatalog';

/**
 * Species-specific bait and technique advisor.
 * The shared catalog is the single source of truth for selectable species and advice metadata.
 */
export interface SpeciesAdvice {
  species: string;
  activityLevel: 'high' | 'medium' | 'low';
  activityScore: number;
  topBaits: readonly string[];
  technique: string;
  depthAdvice: string;
  reasoning: string[];
}

interface Conditions {
  water_temp_c: number | null;
  pressure_hpa: number | null;
  wind_speed_ms: number | null;
  dissolved_oxygen_mgl: number | null;
  is_daytime: boolean;
  solunar_score: number;
}

export function getSpeciesAdvice(species: string, conditions: Conditions): SpeciesAdvice {
  const catalogSpecies = findSpecies(species);
  const db = catalogSpecies?.advice;

  if (!db) {
    return {
      species,
      activityLevel: 'medium',
      activityScore: 50,
      topBaits: ['Live bait', 'Artificial lures'],
      technique: 'Match the hatch for local conditions.',
      depthAdvice: 'Check local reports for depth.',
      reasoning: ['No species-specific data available'],
    };
  }

  const temp = conditions.water_temp_c;
  const isOptimalTemp = temp !== null && temp >= db.optTempMin && temp <= db.optTempMax;
  const isWarm = temp !== null && temp >= (db.optTempMin + db.optTempMax) / 2;
  const pressureAvailable = conditions.pressure_hpa !== null;
  const pressureAboveThreshold = pressureAvailable && conditions.pressure_hpa >= 1010;

  let activityScore = 50;
  const reasoning: string[] = [];

  if (isOptimalTemp) {
    activityScore += 20;
    reasoning.push(`Water temp ${temp != null ? (temp * 9 / 5 + 32).toFixed(1) : 'unknown'}°F is in optimal range`);
  } else if (temp !== null) {
    activityScore -= 15;
    reasoning.push(`Water temp ${(temp * 9 / 5 + 32).toFixed(1)}°F outside optimal (${Math.round(db.optTempMin * 9 / 5 + 32)}–${Math.round(db.optTempMax * 9 / 5 + 32)}°F)`);
  }

  if (pressureAboveThreshold) {
    activityScore += 10;
    reasoning.push('Pressure is above the advisor threshold; no pressure trend is available.');
  } else if (pressureAvailable) {
    reasoning.push('Pressure is below the advisor threshold; no pressure trend is available.');
  } else {
    reasoning.push('Pressure unavailable; no pressure adjustment applied.');
  }

  if (conditions.dissolved_oxygen_mgl === null) {
    reasoning.push('Dissolved oxygen unavailable; no oxygen adjustment applied.');
  } else if (conditions.dissolved_oxygen_mgl < 5) {
    activityScore -= 20;
    reasoning.push('Low dissolved oxygen detected');
  }

  if (!conditions.is_daytime) {
    activityScore += 10;
    reasoning.push('Low-light conditions favor feeding');
  }

  activityScore += Math.round((conditions.solunar_score - 50) * 0.2);
  if (conditions.solunar_score >= 75) {
    reasoning.push('Phase-based solunar estimate indicates potentially favorable activity.');
  }

  activityScore = Math.max(0, Math.min(100, activityScore));
  const activityLevel = activityScore >= 65 ? 'high' : activityScore >= 40 ? 'medium' : 'low';

  return {
    species: catalogSpecies.name,
    activityLevel,
    activityScore,
    topBaits: temp === null
      ? [...new Set([...db.baitsWarm, ...db.baitsCold])]
      : isWarm
        ? db.baitsWarm
        : db.baitsCold,
    technique: temp === null
      ? 'Water temperature unavailable; choose a technique based on current local observations.'
      : isWarm
        ? db.techniqueWarm
        : db.techniqueCold,
    depthAdvice: temp === null
      ? 'Water temperature unavailable; use local conditions to choose a target depth.'
      : isWarm
        ? db.depthWarm
        : db.depthCold,
    reasoning,
  };
}
export function getSpeciesImage(speciesName: string): string | null {
  return findSpecies(speciesName)?.image ?? null;
}
