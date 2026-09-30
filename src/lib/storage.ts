import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'fishfinder-pro-db';
const STORE_NAMES = {
  CATALOG: 'species-catalog',
  STRATEGIES: 'ai-strategies',
  SITES: 'cached-spots',
  CHECKLISTS: 'checklists',
};

export class StorageManager {
  private static dbPromise: Promise<IDBPDatabase> =
    typeof window === 'undefined'
      ? Promise.reject(new Error('IndexedDB is only available in the browser'))
      : openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAMES.CATALOG)) {
        db.createObjectStore(STORE_NAMES.CATALOG);
      }
      if (!db.objectStoreNames.contains(STORE_NAMES.STRATEGIES)) {
        db.createObjectStore(STORE_NAMES.STRATEGIES);
      }
      if (!db.objectStoreNames.contains(STORE_NAMES.SITES)) {
        db.createObjectStore(STORE_NAMES.SITES);
      }
    },
  });

  static async set(store: keyof typeof STORE_NAMES, key: string, value: any) {
    const db = await this.dbPromise;
    await db.put(STORE_NAMES[store], value, key);
  }

  static async get(store: keyof typeof STORE_NAMES, key: string) {
    const db = await this.dbPromise;
    return db.get(STORE_NAMES[store], key);
  }

  static async getAll(store: keyof typeof STORE_NAMES) {
    const db = await this.dbPromise;
    return db.getAll(STORE_NAMES[store]);
  }

  static async delete(store: keyof typeof STORE_NAMES, key: string) {
    const db = await this.dbPromise;
    await db.delete(STORE_NAMES[store], key);
  }

  static async clear(store: keyof typeof STORE_NAMES) {
    const db = await this.dbPromise;
    await db.clear(STORE_NAMES[store]);
  }
}
