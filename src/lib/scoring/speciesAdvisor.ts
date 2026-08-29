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
export function getSpeciesImage(speciesName: string): string {
  const resolved = SPECIES_ALIASES[speciesName] || speciesName;
  return SPECIES_IMAGES[resolved] ?? SPECIES_IMAGES['Largemouth Bass'];
}
const SPECIES_IMAGES: Record<string, string> = {
  'Largemouth Bass': 'bass.jpg',
  'Smallmouth Bass': 'smallmouth.jpg',
  'Crappie': 'crappie.jpg',
  'Bluegill': 'bluegill.jpg',
  'Channel Catfish': 'catfish.jpg',
  'Walleye': 'walleye.jpg',
  'Northern Pike': 'pike.jpg',
  'Muskie': 'muskie.jpg',
  'Rainbow Trout': 'trout.jpg',
  'Brown Trout': 'brown-trout.jpg',
  'Brook Trout': 'brook-trout.jpg',
  'Lake Trout': 'lake-trout.jpg',
  'Salmon': 'salmon.jpg',
  'Steelhead': 'steelhead.jpg',
  'Perch': 'perch.jpg',
  'Carp': 'carp.jpg',
  'Gar': 'gar.jpg',
  'Sturgeon': 'sturgeon.jpg',
  'Bowfin': 'bowfin.jpg',
  'White Bass': 'white-bass.jpg',
  'Hybrid Striped Bass': 'hybrid-striper.jpg',
  'Striped Bass': 'striped-bass.jpg',
  'Redfish': 'redfish.jpg',
  'Speckled Trout': 'speckled-trout.jpg',
  'Snook': 'snook.jpg',
  'Tarpon': 'tarpon.jpg',
  'Bonefish': 'bonefish.jpg',
  'Permit': 'permit.jpg',
  'Grouper': 'grouper.jpg',
  'Snapper': 'snapper.jpg',
  'Flounder': 'flounder.jpg',
  'Halibut': 'halibut.jpg',
  'Mahi Mahi': 'mahi.jpg',
  'Tuna': 'tuna.jpg',
  'Marlin': 'marlin.jpg',
  'Sailfish': 'sailfish.jpg',
  'Wahoo': 'wahoo.jpg',
  'King Mackerel': 'king-mackerel.jpg',
  'Spanish Mackerel': 'spanish-mackerel.jpg',
  'Cobia': 'cobia.jpg',
  'Amberjack': 'amberjack.jpg',
  'Shark': 'shark.jpg',
  'Other': 'other.jpg',
};

const SPECIES_ALIASES: Record<string, string> = {
  'LMB': 'Largemouth Bass',
  'SMB': 'Smallmouth Bass',
  'White Crappie': 'Crappie',
  'Black Crappie': 'Crappie',
  'Sunfish': 'Bluegill',
  'Blue Catfish': 'Channel Catfish',
  'Flathead Catfish': 'Channel Catfish',
  'Eyes': 'Walleye',
  'Northerns': 'Northern Pike',
  'Musky': 'Muskie',
  'Rainbows': 'Rainbow Trout',
  'Browns': 'Brown Trout',
  'Brookies': 'Brook Trout',
  'Lakers': 'Lake Trout',
  'Kings': 'Salmon',
  'Coho': 'Salmon',
  'Steelies': 'Steelhead',
  'Yellow Perch': 'Perch',
  'Common Carp': 'Carp',
  'Longnose Gar': 'Gar',
  'Spotted Gar': 'Gar',
  'Lake Sturgeon': 'Sturgeon',
  'Whites': 'White Bass',
  'Hybrids': 'Hybrid Striped Bass',
  'Stripers': 'Striped Bass',
  'Reds': 'Redfish',
  'Specks': 'Speckled Trout',
  'Snooks': 'Snook',
  'Tarpons': 'Tarpon',
  'Bones': 'Bonefish',
  'Permits': 'Permit',
  'Gags': 'Grouper',
  'Snappers': 'Snapper',
  'Flukes': 'Flounder',
  'Halibuts': 'Halibut',
  'Dolphins': 'Mahi Mahi',
  'Dorado': 'Mahi Mahi',
  'Bluefin': 'Tuna',
  'Yellowfin': 'Tuna',
  'Black Marlin': 'Marlin',
  'Blue Marlin': 'Marlin',
  'White Marlin': 'Marlin',
  'Sails': 'Sailfish',
  'Wahoos': 'Wahoo',
  'Kingfish': 'King Mackerel',
  'Spaniards': 'Spanish Mackerel',
  'Cobias': 'Cobia',
  'AJs': 'Amberjack',
  'Bulls': 'Shark',
  'Makos': 'Shark',
  'Tigers': 'Shark',
};
