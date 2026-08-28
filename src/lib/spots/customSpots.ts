export interface CustomSpot {
  id: string;
  name: string;
  lat: number;
  lng: number;
  target_species: string;
  notes: string;
  created_at: string;
}

const STORAGE_KEY = 'fishfinder_custom_spots';

export function getCustomSpots(): CustomSpot[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveCustomSpot(spot: Omit<CustomSpot, 'id' | 'created_at'>): CustomSpot {
  const spots = getCustomSpots();
  const newSpot: CustomSpot = {
    spot,
    id: 'spot_' + Date.now(),
    created_at: new Date().toISOString()
  };
  spots.unshift(newSpot);
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(spots));
  }
  return newSpot;
}

export function deleteCustomSpot(id: string): void {
  const spots = getCustomSpots().filter(s => s.id !== id);
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(spots));
  }
}
