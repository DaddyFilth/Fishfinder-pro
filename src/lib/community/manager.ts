import { openDB } from 'idb';
import { CommunitySpot, COMMUNITY_STORE } from './types';

export class CommunityManager {
  private static dbPromise = openDB('fishfinder-community', 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(COMMUNITY_STORE)) {
        db.createObjectStore(COMMUNITY_STORE, { keyPath: 'id' });
      }
    },
  });

  static async reportSpot(spot: CommunitySpot) {
    const db = await this.dbPromise;
    return db.put(COMMUNITY_STORE, spot);
  }

  static async getActiveSpots(): Promise<CommunitySpot[]> {
    const db = await this.dbPromise;
    return db.getAll(COMMUNITY_STORE);
  }

  static async getSpotsForSpecies(speciesId: string): Promise<CommunitySpot[]> {
    const db = await this.dbPromise;
    const all = await db.getAll(COMMUNITY_STORE);
    return all.filter(s => s.speciesId === speciesId);
  }
}
