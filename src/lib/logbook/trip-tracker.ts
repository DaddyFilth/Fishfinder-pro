import { Geolocation } from '@capacitor/geolocation';
import { openDB } from 'idb';

export interface Breadcrumb {
  lat: number;
  lng: number;
  timestamp: number;
}

export interface Trip {
  id: string;
  startTime: number;
  endTime?: number;
  breadcrumbs: Breadcrumb[];
  spotId: string;
}

export const TRIPS_STORE = 'user_trips';

export class TripTracker {
  private static dbPromise = openDB('fishfinder-trips', 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(TRIPS_STORE)) {
        db.createObjectStore(TRIPS_STORE, { keyPath: 'id' });
      }
    },
  });

  private static activeTripId: string | null = null;
  private static trackingInterval: any = null;

  static async startTrip(spotId: string) {
    const id = crypto.randomUUID();
    this.activeTripId = id;

    const trip: Trip = {
      id,
      startTime: Date.now(),
      breadcrumbs: [],
      spotId,
    };

    const db = await this.dbPromise;
    await db.put(TRIPS_STORE, trip);

    // Start background tracking
    this.trackingInterval = setInterval(() => this.recordPosition(), 30000); // Every 30 seconds
    await this.recordPosition(); // Immediate first point
    
    return id;
  }

  static async recordPosition() {
    if (!this.activeTripId) return;

    try {
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
      });

      const breadcrumb: Breadcrumb = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        timestamp: Date.now(),
      };

      const db = await this.dbPromise;
      const trip = await db.get(TRIPS_STORE, this.activeTripId);
      if (trip) {
        trip.breadcrumbs.push(breadcrumb);
        await db.put(TRIPS_STORE, trip);
      }
    } catch (err) {
      console.error('[TripTracker] Position Error:', err);
    }
  }

  static async stopTrip() {
    if (!this.activeTripId) return;

    clearInterval(this.trackingInterval);
    
    const db = await this.dbPromise;
    const trip = await db.get(TRIPS_STORE, this.activeTripId);
    if (trip) {
      trip.endTime = Date.now();
      await db.put(TRIPS_STORE, trip);
    }

    this.activeTripId = null;
  }

  static async getTrip(id: string): Promise<Trip | undefined> {
    const db = await this.dbPromise;
    return db.get(TRIPS_STORE, id);
  }

  static async getAllTrips(): Promise<Trip[]> {
    const db = await this.dbPromise;
    return db.getAll(TRIPS_STORE);
  }
}
