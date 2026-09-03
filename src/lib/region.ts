import type { NorthAmericanState, Species } from '@/lib/speciesCatalog';

export interface Coordinates { latitude: number; longitude: number }

// Oklahoma is the app's initial map region; unknown locations remain usable rather than hiding all species.
export const OKLAHOMA_CENTER: Coordinates = { latitude: 35.5, longitude: -97.5 };

export function stateFromCoordinates({ latitude, longitude }: Coordinates): NorthAmericanState | null {
  if (latitude >= 33.6 && latitude <= 37.1 && longitude >= -103.1 && longitude <= -94.4) return 'OK';
  return null;
}

export function speciesForCoordinates(species: readonly Species[], coordinates?: Coordinates | null) {
  const state = coordinates ? stateFromCoordinates(coordinates) : null;
  return state ? species.filter((item) => item.states.includes(state)) : [...species];
}

export function requestDeviceLocation(onResult: (coordinates: Coordinates | null) => void) {
  if (typeof navigator === 'undefined' || !navigator.geolocation) { onResult(null); return () => {}; }
  let active = true;
  navigator.geolocation.getCurrentPosition(
    (position) => { if (active) onResult({ latitude: position.coords.latitude, longitude: position.coords.longitude }); },
    () => { if (active) onResult(null); },
    { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
  );
  return () => { active = false; };
}
