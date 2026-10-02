/* eslint-disable @typescript-eslint/no-explicit-any -- IndexedDB records are runtime-shaped. */
import { openDB } from 'idb';
import { Catch, LOGBOOK_STORE } from './types';

export const SYNC_QUEUE_STORE = 'sync_queue';

export class LogbookManager {
  private static dbPromise = typeof window === 'undefined' ? Promise.reject(new Error('IndexedDB is only available in the browser')) : openDB('fishfinder-logbook', 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(LOGBOOK_STORE)) {
        db.createObjectStore(LOGBOOK_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(SYNC_QUEUE_STORE)) {
        db.createObjectStore(SYNC_QUEUE_STORE, { keyPath: 'id' });
      }
    },
  });

  static async addCatch(catchData: Catch) {
    const db = await this.dbPromise;
    return db.put(LOGBOOK_STORE, catchData);
  }

  static async queueForSync(catchData: any) {
    const db = await this.dbPromise;
    return db.put(SYNC_QUEUE_STORE, { 
      id: catchData.id || crypto.randomUUID(), 
      data: catchData, 
      timestamp: Date.now() 
    });
  }

  static async getSyncQueue() {
    const db = await this.dbPromise;
    return db.getAll(SYNC_QUEUE_STORE);
  }

  static async removeFromQueue(id: string) {
    const db = await this.dbPromise;
    return db.delete(SYNC_QUEUE_STORE, id);
  }

  static async getAllCatches(): Promise<Catch[]> {
    const db = await this.dbPromise;
    return db.getAll(LOGBOOK_STORE);
  }

  static async deleteCatch(id: string) {
    const db = await this.dbPromise;
    return db.delete(LOGBOOK_STORE, id);
  }

  static async getStats() {
    const catches = await this.getAllCatches();
    if (catches.length === 0) return null;

    const speciesCounts: Record<string, number> = {};
    catches.forEach(c => {
      const name = (c as any).speciesName || (c as any).species;
      speciesCounts[name] = (speciesCounts[name] || 0) + 1;
    });

    const topSpecies = Object.entries(speciesCounts).sort((a, b) => b[1] - a[1])[0][0];

    return {
      totalCatches: catches.length,
      speciesDiversity: Object.keys(speciesCounts).length,
      topSpecies,
      successRate: 0,
    };
  }
}
