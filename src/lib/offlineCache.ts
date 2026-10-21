import { openDB } from 'idb';
import type { Spot } from '@/lib/mapFilters';

const DB_NAME = 'fishfinder-offline';
const STORE = 'spots';
const CACHE_KEY = 'catalog';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type CachedSpots = { savedAt: number; spots: Spot[] };

async function db() {
  return openDB(DB_NAME, 1, {
    upgrade(database) {
      if (!database.objectStoreNames.contains(STORE)) {
        database.createObjectStore(STORE);
      }
    },
  });
}

export async function readCachedSpots(): Promise<Spot[] | null> {
  try {
    const database = await db();
    const entry = (await database.get(STORE, CACHE_KEY)) as CachedSpots | undefined;
    if (!entry || !Array.isArray(entry.spots)) return null;
    if (Date.now() - entry.savedAt > CACHE_TTL_MS) return null;
    return entry.spots;
  } catch {
    return null;
  }
}

export async function writeCachedSpots(spots: Spot[]): Promise<void> {
  try {
    const database = await db();
    await database.put(STORE, { savedAt: Date.now(), spots } satisfies CachedSpots, CACHE_KEY);
  } catch {
    // IndexedDB may be unavailable; ignore.
  }
}
