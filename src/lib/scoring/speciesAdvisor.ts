/**
 * Species-specific bait and technique advisor
 * Conditions mapped from published angler guides, state agency fish biology docs
 */

export interface SpeciesAdvice {
  species: string;
  activityLevel: 'high' | 'medium' | 'low';
  activityScore: number;
  topBaits: string[];
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

const SPECIES_DB: Record<string, {
  optTempMin: number; optTempMax: number;
  baitsWarm: string[]; baitsCold: string[];
  techniqueWarm: string; techniqueCold: string;
  depthWarm: string; depthCold: string;
}> = {
  'Largemouth Bass': {
    optTempMin: 15.6, optTempMax: 26.7,
    baitsWarm: ['Topwater frogs','Spinnerbaits','Swimbaits','Texas-rigged worms'],
    baitsCold: ['Jigging spoons','Drop-shot rigs','Ned rigs','Blade baits'],
    techniqueWarm: 'Work shallow cover and structure. Slow-roll spinnerbaits at dawn.',
    techniqueCold: 'Slow presentation near deep structure. Finesse tactics work best.',
    depthWarm: 'Shallow (2–8ft) near cover', depthCold: 'Deep (15–30ft) near bottom',
  },
  'Channel Catfish': {
    optTempMin: 21, optTempMax: 29,
    baitsWarm: ['Chicken liver','Nightcrawlers','Stink bait','Cut shad'],
    baitsCold: ['Live bream','Cut carp','Shrimp'],
    techniqueWarm: 'Bottom fishing near channel edges at dusk/night.',
    techniqueCold: 'Deep holes and ledges. Slow-moving bait presentations.',
    depthWarm: 'Mid-depth (5–15ft) channel edges', depthCold: 'Deep holes (15–40ft)',
  },
  'Walleye': {
    optTempMin: 10, optTempMax: 18,
    baitsWarm: ['Jigs with live minnows','Nightcrawler harnesses','Crankbaits'],
    baitsCold: ['Jigging Raps','Blade baits','Live suckers'],
    techniqueWarm: 'Troll along structure at dusk. Target rocky points.',
    techniqueCold: 'Vertical jigging over deep structure. Slow and methodical.',
    depthWarm: 'Mid-depth (8–20ft) rocky structure', depthCold: 'Deep (20–40ft)',
  },
  'Rainbow Trout': {
    optTempMin: 10, optTempMax: 18,
    baitsWarm: ['PowerBait','Salmon eggs','Rooster Tails','Elk Hair Caddis fly'],
    baitsCold: ['Midge patterns','Scuds','Small jigs','Mealworms'],
    techniqueWarm: 'Cast upstream and drift naturally. Work riffles and pools.',
    techniqueCold: 'Nymph fishing near bottom. Slow drift in deep pools.',
    depthWarm: 'Shallow riffles (1–4ft)', depthCold: 'Deep pools (4–12ft)',
  },
  'Crappie': {
    optTempMin: 15, optTempMax: 23,
    baitsWarm: ['Small jigs (1/32oz)','Minnows','Small spinners'],
    baitsCold: ['Tiny jigs','Small live minnows','Ice fishing jigs'],
    techniqueWarm: 'Slow vertical jigging near brush piles and timber.',
    techniqueCold: 'Very slow presentation near deep brush. Spider rigging.',
    depthWarm: 'Brush piles (4–12ft)', depthCold: 'Deep timber (15–25ft)',
  },
  'Striped Bass': {
    optTempMin: 10, optTempMax: 26,
    baitsWarm: ['Live shad','Umbrella rigs','Surface plugs','Large swimbaits'],
    baitsCold: ['Jigging spoons','Live herring','Blade baits'],
    techniqueWarm: 'Troll near thermocline. Target schooling shad at surface.',
    techniqueCold: 'Deep jigging near dam faces and channel drops.',
    depthWarm: 'Surface to mid-depth chasing shad schools', depthCold: 'Deep (20–60ft)',
  },
  'Redfish/Red Drum': {
    optTempMin: 16, optTempMax: 28,
    baitsWarm: ['Live shrimp','Gold spoons','Popping corks with shrimp'],
    baitsCold: ['Cut mullet','Live blue crab','Soft plastic paddle tails'],
    techniqueWarm: 'Sight-fish tailing reds in shallow flats at high tide.',
    techniqueCold: 'Deeper channels and oyster bars. Slow retrieves.',
    depthWarm: 'Shallow flats (1–4ft) at rising tide', depthCold: 'Deep channels (6–20ft)',
  },
  'Flounder': {
    optTempMin: 14, optTempMax: 24,
    baitsWarm: ['Live finger mullet','Bucktail jigs','Gulp shrimp'],
    baitsCold: ['Cut squid','Live mud minnows','Vertical jigs'],
    techniqueWarm: 'Drag bait slowly along bottom near structure changes.',
    techniqueCold: 'Drift fishing in channels. Very slow bottom presentations.',
    depthWarm: 'Bottom near structure (3–10ft)', depthCold: 'Channel edges (10–25ft)',
  },
};

export function getSpeciesAdvice(species: string, conditions: Conditions): SpeciesAdvice {
  const db = SPECIES_DB[species];
  if (!db) {
    return {
      species, activityLevel: 'medium', activityScore: 50,
      topBaits: ['Live bait','Artificial lures'],
      technique: 'Match the hatch for local conditions.',
      depthAdvice: 'Check local reports for depth.',
      reasoning: ['No species-specific data available'],
    };
  }

  const temp = conditions.water_temp_c;
  const isOptimalTemp = temp !== null && temp >= db.optTempMin && temp <= db.optTempMax;
  const isWarm = temp !== null && temp >= (db.optTempMin + db.optTempMax) / 2;
  const goodPressure = conditions.pressure_hpa !== null && conditions.pressure_hpa >= 1010;
  const goodOxygen   = conditions.dissolved_oxygen_mgl === null || conditions.dissolved_oxygen_mgl >= 5;

  let activityScore = 50;
  const reasoning: string[] = [];

  if (isOptimalTemp)   { activityScore += 20; reasoning.push(`Water temp ${temp?.toFixed(1)}°C is in optimal range`); }
  else if (temp !== null) { activityScore -= 15; reasoning.push(`Water temp ${temp.toFixed(1)}°C outside optimal (${db.optTempMin}–${db.optTempMax}°C)`); }
  if (goodPressure)    { activityScore += 10; reasoning.push('Stable high pressure — feeding activity likely'); }
  else                 { activityScore -= 10; reasoning.push('Low/falling pressure — fish may be sluggish'); }
  if (!goodOxygen)     { activityScore -= 20; reasoning.push('Low dissolved oxygen detected'); }
  if (!conditions.is_daytime) { activityScore += 10; reasoning.push('Low-light conditions favor feeding'); }
  activityScore += Math.round((conditions.solunar_score - 50) * 0.2);
  if (conditions.solunar_score >= 75) reasoning.push('Strong solunar period — peak activity window');

  activityScore = Math.max(0, Math.min(100, activityScore));
  const activityLevel = activityScore >= 65 ? 'high' : activityScore >= 40 ? 'medium' : 'low';

  return {
    species,
    activityLevel,
    activityScore,
    topBaits: isWarm ? db.baitsWarm : db.baitsCold,
    technique: isWarm ? db.techniqueWarm : db.techniqueCold,
    depthAdvice: isWarm ? db.depthWarm : db.depthCold,
    reasoning,
  };
}

export const AVAILABLE_SPECIES = Object.keys(SPECIES_DB);
