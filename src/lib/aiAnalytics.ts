import type { Spot } from '@/lib/mapFilters';
import { DEFAULT_SPOTS } from './defaultSpots';
import {
  SPECIES,
  type Species,
  type FishingCondition,
} from './speciesCatalog';

export interface EnvironmentalConditions {
  waterTempC: number | null;
  waterTempF: number | null;
  airTempC: number | null;
  airTempF: number | null;
  windSpeedMs: number | null;
  windSpeedMph: number | null;
  windDirection: string | null;
  dissolvedOxygenMgl: number | null;
  fishingScore: number | null;
  condition: FishingCondition | null;
}

export interface SpotAnalysis {
  spot: Spot;
  suitabilityScore: number;
  recommendedSpecies: Species[];
  recommendedBait: string;
  recommendedTechnique: string;
  bestBiteWindow: string;
  reason: string;
}

export interface SmartAnalyticsInput {
  userLat?: number;
  userLng?: number;
  targetSpecies?: string;
  conditions?: EnvironmentalConditions;
  season?: 'Spring' | 'Summer' | 'Fall' | 'Winter';
  currentTimeHour?: number;
}

export interface SmartAnalyticsResult {
  analysisId: string;
  location: { lat: number; lng: number };
  analyzedSpots: SpotAnalysis[];
  overallBestSpot: SpotAnalysis | null;
  overallBestSpecies: Species | null;
  dataSource: 'local-catalog';
  generatedAt: string;
}

function getSeason(currentHour: number, explicitSeason?: 'Spring' | 'Summer' | 'Fall' | 'Winter'): 'Spring' | 'Summer' | 'Fall' | 'Winter' {
  if (explicitSeason) return explicitSeason;
  const month = new Date().toLocaleString('en-US', { month: 'long' });
  if (['December', 'January', 'February'].includes(month)) return 'Winter';
  if (['March', 'April', 'May'].includes(month)) return 'Spring';
  if (['June', 'July', 'August'].includes(month)) return 'Summer';
  return 'Fall';
}

function computeSuitabilityScore(
  spot: Spot,
  conditions: EnvironmentalConditions | undefined,
): number {
  let score = 50;
  const cond = conditions || {} as EnvironmentalConditions;

  if (cond.waterTempF !== null && cond.airTempF !== null) {
    const tempDiff = Math.abs(cond.waterTempF - 75);
    const tempPenalty = Math.min(tempDiff / 15, 20);
    score -= tempPenalty;
  }

  if (cond.windSpeedMph !== null && cond.windSpeedMph > 10) {
    score -= 10;
  }

  if (cond.fishingScore !== null) {
    score = Math.max(10, Math.min(90, cond.fishingScore));
  }

  return Math.max(10, Math.min(90, score));
}

function getBestBiteWindow(
  spot: Spot,
  conditions: EnvironmentalConditions | undefined,
  species: Species,
  season: 'Spring' | 'Summer' | 'Fall' | 'Winter',
  hour: number
): string {
  const timeOfDay = hour >= 5 && hour < 10 ? 'morning'
    : hour >= 10 && hour < 16 ? 'afternoon'
    : hour >= 16 && hour < 21 ? 'evening'
    : 'night';

  let window = species.bestTime;

  if (species.bestTime.includes('Dawn') || species.bestTime.includes('Dusk') || species.bestTime.includes('Morning')) {
    window = `Early ${timeOfDay} (${species.bestTime})`;
  } else if (species.bestTime.includes('Night')) {
    window = `Late night / early morning (${species.bestTime})`;
  }

  return window;
}

function generateReason(
  spot: Spot,
  conditions: EnvironmentalConditions | undefined,
  species: Species,
): string {
  const parts: string[] = [];
  const cond = conditions || {} as EnvironmentalConditions;

  if (cond.waterTempF !== null) {
    parts.push(`Water temperature is ${cond.waterTempF}°F.`);
  }
  if (cond.windSpeedMph !== null) {
    parts.push(`Wind is ${cond.windSpeedMph} mph.`);
  }

  const { optTempMin, optTempMax } = species.advice;
  const tempRange = typeof optTempMin === 'number' && typeof optTempMax === 'number'
    ? `${Math.round((optTempMin * 9) / 5 + 32)}-${Math.round((optTempMax * 9) / 5 + 32)}°F`
    : 'unknown range';

  parts.push(`${species.name} prefers water temps of ${tempRange}.`);

  if (cond.fishingScore !== null) {
    parts.push(`Current fishing conditions score: ${cond.fishingScore}/100.`);
  }

  return parts.join(' ');
}

export async function analyzeSpotsSmart(
  input: SmartAnalyticsInput
): Promise<SmartAnalyticsResult> {
  const season = getSeason(input.currentTimeHour ?? 6, input.season);
  const { userLat, userLng, targetSpecies, conditions } = input;

  // Step 1: Filter spots by proximity if coordinates provided
  let spots: Spot[] = [...DEFAULT_SPOTS];
  if (userLat !== undefined && userLng !== undefined) {
    const earthRadiusMiles = 3958.8;
    const toRadians = (deg: number) => (deg * Math.PI) / 180;

    const spottedWithDistance = DEFAULT_SPOTS.map((spot) => {
      let distanceMiles: number | null = null;
      if (userLat !== undefined && userLng !== undefined) {
        const latDiff = toRadians(userLat - spot.lat);
        const lngDiff = toRadians(userLng - spot.lng);
        const a = Math.sin(latDiff / 2) ** 2 + Math.cos(toRadians(userLat)) * Math.cos(toRadians(spot.lat)) * Math.sin(lngDiff / 2) ** 2;
        distanceMiles = earthRadiusMiles * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      }
      return { ...spot, distanceMiles };
    });

    spots = spottedWithDistance
      .sort((a, b) => (a.distanceMiles ?? Infinity) - (b.distanceMiles ?? Infinity))
      .slice(0, 20);
  }

  // Step 2: Determine target species
  let targetSpeciesObj: Species | undefined;
  if (targetSpecies) {
    const guessedId = targetSpecies.toLowerCase().replace(/ /g, '-').replace(/[^a-z0-9-]/g, '');
    targetSpeciesObj = SPECIES.find(
      (s) => s.id === guessedId || s.name.toLowerCase() === targetSpecies.toLowerCase()
    );
    if (!targetSpeciesObj) {
      targetSpeciesObj = SPECIES.find((s) => s.name.toLowerCase().includes(targetSpecies.toLowerCase()));
    }
  }

  // Step 3: Use OKLAHOMA species filtered (SPECIES is already filtered to OK species)
  const okSpecies = SPECIES; // Already filtered to Oklahoma species

  // Step 4: Analyze each spot
  const analyzedSpots = spots.map((spot) => {
    const waterType = String(spot.water_type ?? '').toLowerCase();
    // Catalog habitats are title case ("Freshwater") while spot rows are lower case.
    const habitatMatches = (species: Species) => {
      const habitat = species.habitat.toLowerCase();
      return habitat === waterType || (species.habitat === 'Anadromous' && waterType === 'freshwater');
    };

    const appropriateSpecies = targetSpeciesObj
      ? okSpecies.filter((s) => s.id === targetSpeciesObj.id || habitatMatches(s))
      : okSpecies.filter((s) => habitatMatches(s));

    const speciesToEvaluate = appropriateSpecies.slice(0, 5);

    const spotEvaluations = speciesToEvaluate.map((species) => {
      const effectiveConditions = conditions ? { ...conditions } : undefined;
      const suitability = computeSuitabilityScore(spot, effectiveConditions);
      const biteWindow = getBestBiteWindow(spot, effectiveConditions, species, season, input.currentTimeHour ?? 6);
      const reason = generateReason(spot, effectiveConditions, species);

      return {
        species,
        suitability,
        biteWindow,
        recommendedBait: species.advice.baitsWarm[0],
        recommendedTechnique: species.advice.techniqueWarm,
        reason,
      };
    });

    spotEvaluations.sort((a, b) => b.suitability - a.suitability);

    const bestEvaluation = spotEvaluations[0];
    const recommendedSpecies = bestEvaluation?.species ?? appropriateSpecies[0] ?? okSpecies[0];

    return {
      spot,
      suitabilityScore: bestEvaluation?.suitability ?? 50,
      recommendedSpecies: [recommendedSpecies],
      recommendedBait: bestEvaluation?.recommendedBait ?? recommendedSpecies.advice.baitsWarm[0],
      recommendedTechnique: bestEvaluation?.recommendedTechnique ?? recommendedSpecies.advice.techniqueWarm,
      bestBiteWindow: bestEvaluation?.biteWindow ?? 'Not available',
      reason: bestEvaluation?.reason ?? generateReason(spot, conditions, recommendedSpecies),
    };
  });

  // Sort spots by suitability score
  analyzedSpots.sort((a, b) => b.suitabilityScore - a.suitabilityScore);

  const overallBestSpot = analyzedSpots[0] || null;
  const overallBestSpecies = overallBestSpot?.recommendedSpecies?.[0] || null;

  return {
    analysisId: crypto.randomUUID(),
    location: userLat !== undefined && userLng !== undefined ? { lat: userLat, lng: userLng } : { lat: 0, lng: 0 },
    analyzedSpots,
    overallBestSpot,
    overallBestSpecies,
    dataSource: 'local-catalog',
    generatedAt: new Date().toISOString(),
  };
}