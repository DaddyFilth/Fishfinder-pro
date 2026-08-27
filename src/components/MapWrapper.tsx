'use client';
import dynamic from 'next/dynamic';

const FishingMap = dynamic(() => import('@/components/FishingMap'), { ssr: false });

interface Spot {
  id: string;
  name: string;
  lat: number;
  lng: number;
  water_type: string;
  spot_type: string;
}

export default function MapWrapper({ spots }: { spots: Spot[] }) {
  return <div style={{width:"100%",height:"100%",minHeight:"400px"}}><FishingMap spots={spots} /></div>;
}
