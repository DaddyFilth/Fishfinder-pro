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
  const goodPressure = conditions.pressure_hpa !== null && conditions.pressure_hpa >= 1010;
  const goodOxygen = conditions.dissolved_oxygen_mgl === null || conditions.dissolved_oxygen_mgl >= 5;

  let activityScore = 50;
  const reasoning: string[] = [];

  if (isOptimalTemp) {
    activityScore += 20;
    reasoning.push(`Water temp ${temp?.toFixed(1)}°C is in optimal range`);
  } else if (temp !== null) {
    activityScore -= 15;
    reasoning.push(`Water temp ${temp.toFixed(1)}°C outside optimal (${db.optTempMin}–${db.optTempMax}°C)`);
  }

  if (goodPressure) {
    activityScore += 10;
    reasoning.push('Stable high pressure — feeding activity likely');
  } else {
    activityScore -= 10;
    reasoning.push('Low or falling pressure — fish may be sluggish');
  }

  if (!goodOxygen) {
    activityScore -= 20;
    reasoning.push('Low dissolved oxygen detected');
  }

  if (!conditions.is_daytime) {
    activityScore += 10;
    reasoning.push('Low-light conditions favor feeding');
  }

  activityScore += Math.round((conditions.solunar_score - 50) * 0.2);
  if (conditions.solunar_score >= 75) {
    reasoning.push('Strong solunar period — peak activity window');
  }

  activityScore = Math.max(0, Math.min(100, activityScore));
  const activityLevel = activityScore >= 65 ? 'high' : activityScore >= 40 ? 'medium' : 'low';

  return {
    species: catalogSpecies.name,
    activityLevel,
    activityScore,
    topBaits: isWarm ? db.baitsWarm : db.baitsCold,
    technique: isWarm ? db.techniqueWarm : db.techniqueCold,
    depthAdvice: isWarm ? db.depthWarm : db.depthCold,
    reasoning,
  };
}
