import { useState, useEffect } from 'react';
import { speciesForCoordinates, type Coordinates } from '@/lib/region';
import { SPECIES, biteRateFor } from '@/lib/speciesCatalog';

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

  const scanForPredictions = async () => {
    if (!coordinates) return;
    setIsLoading(true);
    
    try {
      // In a real app, we'd fetch current weather/water temp here.
      // For now, we'll simulate the "Condition" logic from the SpeciesTab.
      const currentCondition = 'stable'; // Simulated current condition
      
      const regionalSpecies = speciesForCoordinates(SPECIES, coordinates);
      const results = regionalSpecies.map(s => {
        const rate = biteRateFor(s, currentCondition);
        return {
          speciesId: s.id,
          name: s.name,
          biteRate: rate,
          isPrime: rate >= 70,
          reason: rate >= 70 ? 'Prime Window' : rate >= 40 ? 'Active' : 'Low Activity'
        };
      })
      .filter(p => p.biteRate >= 40) // Only show active or prime
      .sort((a, b) => b.biteRate - a.biteRate);

      setPredictions(results);
    } catch (e) {
      console.error('Prediction error:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    scanForPredictions();
  }, [coordinates]);

  return { predictions, isLoading, refresh: scanForPredictions };
}
