import React, { useMemo } from 'react';
import { CircleMarker } from 'react-leaflet';
import { SPECIES, biteRateFor } from '@/lib/speciesCatalog';
import { FishingCondition } from '@/lib/speciesCatalog';

interface HotZoneProps {
  center: [number, number];
  condition: FishingCondition | null;
  visible: boolean;
}

export default function HotZoneOverlay({ center, condition, visible }: HotZoneProps) {
  const activeSpecies = useMemo(() => {
    if (!condition) return [];
    return SPECIES.filter(s => {
      const rate = biteRateFor(s, condition);
      return rate >= 70; // Only highlight "Prime" species
    });
  }, [condition]);

  if (!visible || !condition || activeSpecies.length === 0) return null;

  return (
    <>
      {activeSpecies.map(s => (
        <CircleMarker
          key={s.id}
          center={center}
          radius={500} // Represent area of influence
          pathOptions={{
            fillColor: '#22d3ee',
            fillOpacity: 0.2,
            color: '#22d3ee',
            weight: 1,
            dashArray: '5, 10',
          }}
        />
      ))}
    </>
  );
}
