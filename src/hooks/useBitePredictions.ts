import { useState, useEffect, useCallback } from 'react';
import { speciesForCoordinates, type Coordinates } from '@/lib/region';
import { SPECIES, biteRateFor } from '@/lib/speciesCatalog';
import { nearestLiveCondition } from '@/lib/nearbyCondition';

export interface Prediction {
  speciesId: string;
  name: string;
  biteRate: number;
  reason: string;
  isPrime: boolean;
}

export function useBitePredictions(coordinates: Coordinates | null) {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const scanForPredictions = useCallback(async () => {
    if (!coordinates) return;
    setIsLoading(true);

    try {
      // Real provider conditions drive the ranking; when no live reading is
      // available we surface no predictions rather than guessing a condition.
      const condition = await nearestLiveCondition(coordinates);

      if (!condition) {
        setPredictions([]);
        return;
      }

      const regionalSpecies = speciesForCoordinates(SPECIES, coordinates);
      const results = regionalSpecies
        .map((s) => {
          const rate = biteRateFor(s, condition);
          return {
            speciesId: s.id,
            name: s.name,
            biteRate: rate,
            isPrime: rate >= 70,
            reason: rate >= 70 ? 'Prime Window' : rate >= 40 ? 'Active' : 'Low Activity',
          };
        })
        .filter((p) => p.biteRate >= 40)
        .sort((a, b) => b.biteRate - a.biteRate);

      setPredictions(results);
    } catch (e) {
      console.error('Prediction error:', e);
    } finally {
      setIsLoading(false);
    }
  }, [coordinates]);

  useEffect(() => {
    // Defer the loading state so it is not set synchronously in the effect
    // body, and guard the update against the effect re-running early.
    const id = setTimeout(() => {
      setIsLoading(true);
    }, 0);
    (async () => {
      try {
        await scanForPredictions();
      } finally {
        clearTimeout(id);
      }
    })();
    return () => clearTimeout(id);
  }, [scanForPredictions]);

  return { predictions, isLoading, refresh: scanForPredictions };
}
