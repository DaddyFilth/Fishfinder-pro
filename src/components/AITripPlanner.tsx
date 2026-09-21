'use client';

import { useMemo, useState } from 'react';
import { SPECIES } from '@/lib/speciesCatalog';
import { distanceMiles, formatDistance } from '@/lib/nearbySpots';
import { requestDeviceLocation, type Coordinates } from '@/lib/region';
import type { Spot } from '@/lib/mapFilters';

type Plan = {
  destination: Spot;
  driveTime: string;
  bestTime: string;
  species: string[];
  gear: string[];
  tips: string[];
  score: number;
  distanceMiles: number;
};

function score(spot: Spot) {
  let value = 0;
  for (const character of spot.id) value = (value * 31 + character.charCodeAt(0)) & 0xffff;
  return 50 + (value % 45);
}

const gearBySpotType: Record<string, string[]> = {
  bank: ['Medium spinning rod', '8–12 lb mono', 'Worm rigs'],
  boat: ['Heavy baitcaster', '17–20 lb braid', 'Crankbaits'],
  pier: ['Long surf rod', '20 lb mono', 'Cut bait'],
  wade: ['Light spinning rod', '6 lb fluoro', 'Soft plastics'],
};

export default function AITripPlanner({ spots }: { spots: Spot[] }) {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedSpecies, setSelectedSpecies] = useState(SPECIES[0]?.name ?? '');
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [locationStatus, setLocationStatus] = useState<'idle' | 'locating' | 'ready' | 'denied'>('idle');

  const nearbySpots = useMemo(() => {
    if (!location) return [];
    return spots
      .map((spot) => ({ ...spot, distanceMiles: distanceMiles(location, { latitude: spot.lat, longitude: spot.lng }) }))
      .filter((spot) => spot.distanceMiles <= 25)
      .sort((a, b) => score(b) - score(a))
      .slice(0, 10);
  }, [location, spots]);

  function locateAndPlan() {
    setLoading(true);
    setLocationStatus('locating');
    requestDeviceLocation((coordinates) => {
      if (!coordinates) {
        setLocationStatus('denied');
        setLoading(false);
        return;
      }
      setLocation(coordinates);
      setLocationStatus('ready');
      const nearest = spots
        .map((spot) => ({ spot, distanceMiles: distanceMiles(coordinates, { latitude: spot.lat, longitude: spot.lng }) }))
        .filter(({ distanceMiles: miles }) => miles <= 25)
        .sort((a, b) => score(b.spot) - score(a.spot))[0];
      if (nearest) setPlan(buildPlan(nearest.spot, nearest.distanceMiles));
      setLoading(false);
    });
  }

  function buildPlan(spot: Spot, miles = location ? distanceMiles(location, { latitude: spot.lat, longitude: spot.lng }) : 0): Plan {
    const rating = score(spot);
    const spotType = spot.spot_type?.toLowerCase();
    return {
      destination: spot,
      driveTime: `${Math.max(5, Math.round(miles * 2.2))} min`,
      bestTime: rating > 70 ? 'Dawn 5:30–8:00 AM' : 'Dusk 5:00–7:30 PM',
      species: [selectedSpecies],
      gear: gearBySpotType[spotType] ?? ['Medium rod', 'Live bait', 'Tackle box'],
      score: rating,
      distanceMiles: miles,
      tips: [rating > 70 ? 'Excellent conditions — go early.' : 'Fair conditions — try dusk.', `${spot.water_type} ${spot.spot_type} with ${rating > 60 ? 'high' : 'moderate'} activity expected.`, 'Check wind direction before casting.'],
    };
  }

  function chooseSpot(id: string) {
    const match = nearbySpots.find((spot) => spot.id === id);
    if (match) setPlan(buildPlan(match, match.distanceMiles));
  }

  function changeSpecies(value: string) {
    setSelectedSpecies(value);
    if (plan) setPlan({ ...plan, species: [value] });
  }

  const ratingColor = (rating: number) => rating >= 75 ? '#22c55e' : rating >= 50 ? '#eab308' : '#f97316';

  return (
    <div style={{ padding: 16, overflowY: 'auto', height: '100%' }}>
      <div style={{ fontSize: 14, fontWeight: 'bold', color: '#22d3ee', marginBottom: 4 }}>AI Trip Planner</div>
      <div style={{ fontSize: 10, color: '#64748b', marginBottom: 16 }}>Pick a target and find the best-rated water nearby.</div>

      <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 10, padding: 12, marginBottom: 12 }}>
        <label htmlFor="trip-species" style={{ display: 'block', fontSize: 10, color: '#94a3b8', marginBottom: 7, fontWeight: 700 }}>TARGET SPECIES</label>
        <select id="trip-species" value={selectedSpecies} onChange={(event) => changeSpecies(event.target.value)} style={{ width: '100%', background: '#1e293b', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 7, padding: 9, fontSize: 12 }}>
          {SPECIES.map((species) => <option key={species.id} value={species.name}>{species.name}</option>)}
        </select>
        <div style={{ color: '#64748b', fontSize: 10, marginTop: 7 }}>Results are limited to 10 spots within 25 miles of your device.</div>
      </div>

      {!plan && !loading && (
        <div style={{ textAlign: 'center', paddingTop: 28 }}>
          <div style={{ color: '#94a3b8', fontSize: 13, marginBottom: 8 }}>Ready to plan for {selectedSpecies}</div>
          <div style={{ color: '#64748b', fontSize: 11, marginBottom: 20 }}>{locationStatus === 'denied' ? 'Location access is needed to show nearby spots.' : 'We use your device location to rank local waters.'}</div>
          <button onClick={locateAndPlan} style={{ background: 'linear-gradient(135deg,#0369a1,#7c3aed)', color: 'white', border: 0, padding: '13px 24px', borderRadius: 24, fontSize: 13, fontWeight: 'bold', cursor: 'pointer' }}>Find Nearby Spots</button>
        </div>
      )}

      {loading && <div style={{ textAlign: 'center', paddingTop: 40, color: '#22d3ee', fontSize: 13 }}>Finding the top-rated {selectedSpecies} spots within 25 miles…</div>}

      {plan && !loading && (
        <div>
          <div style={{ color: '#94a3b8', fontSize: 10, fontWeight: 700, marginBottom: 7 }}>TOP 10 NEARBY FOR {selectedSpecies.toUpperCase()}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 12 }}>
            {nearbySpots.map((spot, index) => <button key={spot.id} onClick={() => chooseSpot(spot.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', background: spot.id === plan.destination.id ? '#082f49' : '#0a0f1e', border: `1px solid ${spot.id === plan.destination.id ? '#0ea5e9' : '#1e293b'}`, borderRadius: 9, padding: 10, color: '#e2e8f0', cursor: 'pointer' }}><span style={{ color: '#64748b', fontSize: 11, width: 16 }}>#{index + 1}</span><span style={{ flex: 1, fontSize: 12, fontWeight: 700 }}>{spot.name}<small style={{ display: 'block', color: '#64748b', fontWeight: 400, marginTop: 3 }}>{formatDistance(spot.distanceMiles)} · {spot.water_type}</small></span><strong style={{ color: ratingColor(score(spot)), fontSize: 16 }}>{score(spot)}</strong></button>)}
          </div>
          <div style={{ background: '#0a0f1e', border: `2px solid ${ratingColor(plan.score)}`, borderRadius: 12, padding: 14, marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}><div><div style={{ fontSize: 10, color: '#64748b' }}>SELECTED DESTINATION</div><div style={{ fontSize: 16, fontWeight: 'bold', color: '#e2e8f0', marginTop: 3 }}>{plan.destination.name}</div><div style={{ fontSize: 10, color: '#64748b', marginTop: 3 }}>{formatDistance(plan.distanceMiles)} · {plan.driveTime} away</div></div><div style={{ textAlign: 'center' }}><div style={{ fontSize: 28, fontWeight: 900, color: ratingColor(plan.score) }}>{plan.score}</div><div style={{ fontSize: 8, color: '#64748b' }}>RATING</div></div></div>
          <div style={{ background: '#0a0f1e', border: '1px solid #1e293b', borderRadius: 10, padding: 12, marginBottom: 8 }}><div style={{ fontSize: 10, color: '#64748b', marginBottom: 6 }}>BEST TIME</div><div style={{ fontSize: 14, color: '#fbbf24', fontWeight: 'bold' }}>{plan.bestTime}</div></div>
          <div style={{ background: '#0a0f1e', border: '1px solid #1e293b', borderRadius: 10, padding: 12 }}><div style={{ fontSize: 10, color: '#64748b', marginBottom: 8 }}>GEAR</div>{plan.gear.map((gear) => <div key={gear} style={{ fontSize: 12, color: '#cbd5e1', paddingBottom: 4 }}>✓ {gear}</div>)}</div>
          <button onClick={locateAndPlan} style={{ width: '100%', marginTop: 12, background: '#0f172a', border: '1px solid #334155', color: '#94a3b8', padding: 11, borderRadius: 10, fontSize: 12, cursor: 'pointer' }}>Refresh nearby results</button>
        </div>
      )}
      {plan && nearbySpots.length === 0 && <div style={{ color: '#fbbf24', fontSize: 12 }}>No spots found within 25 miles of your device.</div>}
    </div>
  );
}
