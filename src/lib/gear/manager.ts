import { openDB } from 'idb';
import { GearItem, DigitalTackleBox, TACKLE_BOX_STORE } from './types';

export class GearManager {
  private static dbPromise = openDB('fishfinder-gear', 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(TACKLE_BOX_STORE)) {
        db.createObjectStore(TACKLE_BOX_STORE, { keyPath: 'userId' });
      }
    },
  });

  static async addGear(userId: string, item: GearItem) {
    const db = await this.dbPromise;
    const box = (await db.get(TACKLE_BOX_STORE, userId)) as DigitalTackleBox || { userId, inventory: [] };
    box.inventory.push(item);
    return db.put(TACKLE_BOX_STORE, box);
  }

  static async getInventory(userId: string): Promise<GearItem[]> {
    const db = await this.dbPromise;
    const box = (await db.get(TACKLE_BOX_STORE, userId)) as DigitalTackleBox || { userId, inventory: [] };
    return box.inventory;
  }

  static async checkGearAvailability(userId: string, requiredItems: string[]): Promise<{ available: string[]; missing: string[] }> {
    const inventory = await this.getInventory(userId);
    const inventoryNames = inventory.map(i => i.name.toLowerCase());
    
    const available = requiredItems.filter(item => inventoryNames.some(inv => inv.includes(item.toLowerCase())));
    const missing = requiredItems.filter(item => !inventoryNames.some(inv => inv.includes(item.toLowerCase())));
    
    return { available, missing };
  }
}
