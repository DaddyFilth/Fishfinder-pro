'use client';

import dynamic from 'next/dynamic';

interface Spot {
  id: string;
  name: string;
  lat: number;
  lng: number;
  water_type: string;
  spot_type: string;
}

interface FishingMapProps {
  spots: Spot[];
}

const FishingMap = dynamic<FishingMapProps>(() => import('./FishingMap'), {
  ssr: false,
  loading: () => (
    <div
      style={{
        height: '100%',
        width: '100%',
        minHeight: '500px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(180deg, #020617 0%, #0f172a 100%)',
        color: '#cbd5e1',
        fontSize: '14px',
        fontWeight: 600,
        letterSpacing: '0.02em',
      }}
    >
      Loading fishing map...
    </div>
  ),
});

export default function MapWrapper({ spots }: FishingMapProps) {
  return <FishingMap spots={spots} />;
}
