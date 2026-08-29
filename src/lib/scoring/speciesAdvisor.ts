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
<<<<<<< HEAD

export const AVAILABLE_SPECIES = Object.keys(SPECIES_DB);

// Wikimedia Commons — public domain fish illustrations
export const SPECIES_IMAGES: Record<string, string> = {
  'Largemouth Bass': '/species/largemouth-bass.jpg',
  'Smallmouth Bass': '/species/smallmouth-bass.jpg',
  'Spotted Bass': '/species/spotted-bass.jpg',
  'Channel Catfish': '/species/channel-catfish.jpg',
  'Blue Catfish': '/species/blue-catfish.jpg',
  'Flathead Catfish': '/species/flathead-catfish.jpg',
  'Walleye': '/species/walleye.jpg',
  'Rainbow Trout': '/species/rainbow-trout.jpg',
  'Brown Trout': '/species/brown-trout.jpg',
  'Crappie': '/species/crappie.jpg',
  'Black Crappie': '/species/black-crappie.jpg',
  'White Crappie': '/species/white-crappie.jpg',
  'Bluegill': '/species/bluegill.jpg',
  'Redear Sunfish': '/species/redear-sunfish.jpg',
  'Striped Bass': '/species/striped-bass.jpg',
  'White Bass': '/species/white-bass.jpg',
  'Hybrid Striper': '/species/hybrid-striper.jpg',
  'Redfish/Red Drum': '/species/redfish-red-drum.jpg',
  'Flounder': '/species/flounder.jpg',
  'Sauger': '/species/sauger.jpg',
  'Common Carp': '/species/common-carp.jpg',
  'Northern Pike': '/species/northern-pike.jpg',
};

const SPECIES_ALIASES: Record<string, string> = {
  'Redfish': 'Redfish/Red Drum',
  'Red Drum': 'Redfish/Red Drum',
  'Trout': 'Rainbow Trout',
  'Speckled Trout': 'Rainbow Trout',
  'Carp': 'Common Carp',
  'Pike': 'Northern Pike',
};

export function getSpeciesImage(speciesName: string): string {
  const resolved = SPECIES_ALIASES[speciesName] || speciesName;
  return SPECIES_IMAGES[resolved] ?? SPECIES_IMAGES['Largemouth Bass'];
}

=======
>>>>>>> a110a9328e5d62d1fa726120585ff89bc9f61fcd
