/**
 * Species-specific bait and technique advisor
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
  'Smallmouth Bass': {
    optTempMin: 15, optTempMax: 24,
    baitsWarm: ['Tubes','Crayfish imitations','Topwater poppers','Drop-shot'],
    baitsCold: ['Blade baits','Ned rigs','Small jigs','Finesse worms'],
    techniqueWarm: 'Target rocky points and gravel bars. Fast aggressive retrieves.',
    techniqueCold: 'Slow finesse presentations near deep rocky structure.',
    depthWarm: 'Rocky shallows (3–10ft)', depthCold: 'Deep rocky structure (15–30ft)',
  },
  'Spotted Bass': {
    optTempMin: 15, optTempMax: 26,
    baitsWarm: ['Finesse jigs','Drop-shot rigs','Small crankbaits','Topwater'],
    baitsCold: ['Ned rigs','Small swimbaits','Blade baits'],
    techniqueWarm: 'Target main lake points and ledges. Finesse approach.',
    techniqueCold: 'Deep ledge fishing with slow presentations.',
    depthWarm: 'Points and ledges (5–15ft)', depthCold: 'Deep ledges (20–40ft)',
  },
  'Channel Catfish': {
    optTempMin: 21, optTempMax: 29,
    baitsWarm: ['Chicken liver','Nightcrawlers','Stink bait','Cut shad'],
    baitsCold: ['Live bream','Cut carp','Shrimp'],
    techniqueWarm: 'Bottom fishing near channel edges at dusk/night.',
    techniqueCold: 'Deep holes and ledges. Slow-moving bait presentations.',
    depthWarm: 'Mid-depth (5–15ft) channel edges', depthCold: 'Deep holes (15–40ft)',
  },
  'Blue Catfish': {
    optTempMin: 20, optTempMax: 28,
    baitsWarm: ['Cut shad','Live skipjack','Large nightcrawlers'],
    baitsCold: ['Cut carp','Live perch','Large cut bait'],
    techniqueWarm: 'Anchor on main river channel ledges. Heavy tackle.',
    techniqueCold: 'Deep wintering holes. Very slow presentation.',
    depthWarm: 'River channels (10–25ft)', depthCold: 'Deep holes (25–50ft)',
  },
  'Flathead Catfish': {
    optTempMin: 22, optTempMax: 30,
    baitsWarm: ['Live bullheads','Live perch','Live sunfish'],
    baitsCold: ['Live bream','Large shiners'],
    techniqueWarm: 'Night fishing near log jams and deep holes.',
    techniqueCold: 'Very deep holes. Slow live bait presentation.',
    depthWarm: 'Deep cover (8–20ft) at night', depthCold: 'Deep holes (20–40ft)',
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
  'Brown Trout': {
    optTempMin: 8, optTempMax: 18,
    baitsWarm: ['Streamers','Wooly Buggers','Large dry flies','Rapala minnows'],
    baitsCold: ['Midge nymphs','Small egg patterns','Micro jigs'],
    techniqueWarm: 'Large streamers at dawn/dusk near undercut banks.',
    techniqueCold: 'Slow nymph drifts in deep pools.',
    depthWarm: 'Undercut banks and deep pools (2–8ft)', depthCold: 'Deep pools (6–15ft)',
  },
  'Crappie': {
    optTempMin: 15, optTempMax: 23,
    baitsWarm: ['Small jigs (1/32oz)','Minnows','Small spinners'],
    baitsCold: ['Tiny jigs','Small live minnows','Ice fishing jigs'],
    techniqueWarm: 'Slow vertical jigging near brush piles and timber.',
    techniqueCold: 'Very slow presentation near deep brush. Spider rigging.',
    depthWarm: 'Brush piles (4–12ft)', depthCold: 'Deep timber (15–25ft)',
  },
  'Black Crappie': {
    optTempMin: 15, optTempMax: 23,
    baitsWarm: ['Small jigs','Live minnows','Small spinners'],
    baitsCold: ['Tiny jigs','Small minnows'],
    techniqueWarm: 'Vertical jigging near brush and timber at dawn.',
    techniqueCold: 'Deep slow presentation near submerged structure.',
    depthWarm: 'Brush piles (4–12ft)', depthCold: 'Deep timber (15–25ft)',
  },
  'White Crappie': {
    optTempMin: 14, optTempMax: 24,
    baitsWarm: ['Small jigs','Minnows','Tube baits'],
    baitsCold: ['Tiny jigs','Live minnows'],
    techniqueWarm: 'Slow vertical jigging near channel edges and brush.',
    techniqueCold: 'Very slow finesse presentation in deep water.',
    depthWarm: 'Channel edges (6–15ft)', depthCold: 'Deep brush (15–25ft)',
  },
  'Bluegill': {
    optTempMin: 18, optTempMax: 27,
    baitsWarm: ['Crickets','Red worms','Small poppers','Wet flies'],
    baitsCold: ['Wax worms','Small jigs','Mealworms'],
    techniqueWarm: 'Light tackle near weeds and dock edges. Small hooks.',
    techniqueCold: 'Deep slow presentation. Very small baits.',
    depthWarm: 'Shallow weeds (2–6ft)', depthCold: 'Deeper structure (8–15ft)',
  },
  'Redear Sunfish': {
    optTempMin: 18, optTempMax: 27,
    baitsWarm: ['Snails','Worms','Small crickets'],
    baitsCold: ['Wax worms','Small worms'],
    techniqueWarm: 'Bottom fishing near shell beds. Very light tackle.',
    techniqueCold: 'Slow bottom presentation in deeper water.',
    depthWarm: 'Shell beds (4–10ft)', depthCold: 'Deeper structure (10–18ft)',
  },
  'Striped Bass': {
    optTempMin: 10, optTempMax: 26,
    baitsWarm: ['Live shad','Umbrella rigs','Surface plugs','Large swimbaits'],
    baitsCold: ['Jigging spoons','Live herring','Blade baits'],
    techniqueWarm: 'Troll near thermocline. Target schooling shad at surface.',
    techniqueCold: 'Deep jigging near dam faces and channel drops.',
    depthWarm: 'Surface to mid-depth chasing shad schools', depthCold: 'Deep (20–60ft)',
  },
  'White Bass': {
    optTempMin: 14, optTempMax: 24,
    baitsWarm: ['Small spinners','Jigging spoons','Live shad','Tiny crankbaits'],
    baitsCold: ['Blade baits','Small jigs','Jigging spoons'],
    techniqueWarm: 'Target schooling fish at surface. Fast retrieves.',
    techniqueCold: 'Vertical jigging over deep structure near dams.',
    depthWarm: 'Surface schools (0–10ft)', depthCold: 'Deep structure (15–30ft)',
  },
  'Hybrid Striper': {
    optTempMin: 12, optTempMax: 24,
    baitsWarm: ['Live shad','Large swimbaits','Topwater plugs','Umbrella rigs'],
    baitsCold: ['Jigging spoons','Blade baits','Large jigs'],
    techniqueWarm: 'Troll main lake points. Watch for surface busts.',
    techniqueCold: 'Deep jigging along main channel ledges.',
    depthWarm: 'Open water following shad (0–20ft)', depthCold: 'Deep ledges (20–50ft)',
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
  'Sauger': {
    optTempMin: 8, optTempMax: 16,
    baitsWarm: ['Live minnows','Jig-and-minnow','Shallow crankbaits'],
    baitsCold: ['Blade baits','Jigging Raps','Live shiners'],
    techniqueWarm: 'Drift along river current breaks and rocky structure.',
    techniqueCold: 'Vertical jigging in deep current seams.',
    depthWarm: 'River current breaks (5–15ft)', depthCold: 'Deep seams (15–35ft)',
  },
  'Common Carp': {
    optTempMin: 18, optTempMax: 28,
    baitsWarm: ['Corn','Boilies','Bread balls','Dough bait'],
    baitsCold: ['Tiger nuts','Worms','Small boilies'],
    techniqueWarm: 'Bottom fishing with hair rig near weed beds.',
    techniqueCold: 'Slow bottom presentation in deep wintering areas.',
    depthWarm: 'Shallow flats and weed edges (2–8ft)', depthCold: 'Deep holes (10–25ft)',
  },
  'Northern Pike': {
    optTempMin: 10, optTempMax: 20,
    baitsWarm: ['Large swimbaits','Spoons','Topwater gliders','Live suckers'],
    baitsCold: ['Large jigs','Dead smelt','Tip-ups with sucker'],
    techniqueWarm: 'Cast to weed edges and ambush points. Fast erratic retrieves.',
    techniqueCold: 'Slow presentations near weed beds. Deadbait works well.',
    depthWarm: 'Weed edges (3–12ft)', depthCold: 'Deeper weed lines (10–25ft)',
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

  if (isOptimalTemp)      { activityScore += 20; reasoning.push(`Water temp ${temp?.toFixed(1)}°C is in optimal range`); }
  else if (temp !== null) { activityScore -= 15; reasoning.push(`Water temp ${temp.toFixed(1)}°C outside optimal (${db.optTempMin}–${db.optTempMax}°C)`); }
  if (goodPressure)       { activityScore += 10; reasoning.push('Stable high pressure — feeding activity likely'); }
  else                    { activityScore -= 10; reasoning.push('Low/falling pressure — fish may be sluggish'); }
  if (!goodOxygen)        { activityScore -= 20; reasoning.push('Low dissolved oxygen detected'); }
  if (!conditions.is_daytime) { activityScore += 10; reasoning.push('Low-light conditions favor feeding'); }
  activityScore += Math.round((conditions.solunar_score - 50) * 0.2);
  if (conditions.solunar_score >= 75) reasoning.push('Strong solunar period — peak activity window');

  activityScore = Math.max(0, Math.min(100, activityScore));
  const activityLevel = activityScore >= 65 ? 'high' : activityScore >= 40 ? 'medium' : 'low';

  return {
    species, activityLevel, activityScore,
    topBaits: isWarm ? db.baitsWarm : db.baitsCold,
    technique: isWarm ? db.techniqueWarm : db.techniqueCold,
    depthAdvice: isWarm ? db.depthWarm : db.depthCold,
    reasoning,
  };
}

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

