import { LogbookManager } from './manager';
import { supabase } from '../supabase/client';

export class SyncManager {
  private static isSyncing = false;

  static async init() {
    // Listen for the browser's online event to trigger a sync
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.sync());
    }
  }

  static async sync() {
    if (this.isSyncing) return;
    this.isSyncing = true;

    try {
      const queue = await LogbookManager.getSyncQueue();
      if (queue.length === 0) {
        this.isSyncing = false;
        return;
      }

      console.log(`[SyncManager] Found ${queue.length} items in sync queue. Processing...`);

      for (const item of queue) {
        try {
          const { data, id } = item;
          
          // Attempt to push to Supabase via the API or Client
          const { error } = await supabase
            .from('catches')
            .insert([data]);

          if (error) throw error;

          // Remove from queue upon success
          await LogbookManager.removeFromQueue(id);
          console.log(`[SyncManager] Successfully synced catch ${id}`);
        } catch (err) {
          console.error(`[SyncManager] Failed to sync item:`, err);
          // We leave it in the queue to retry later
        }
      }
    } catch (err) {
      console.error('[SyncManager] Critical sync error:', err);
    } finally {
      this.isSyncing = false;
    }
  }

  static async startPeriodicSync(intervalMs = 300000) { // Default 5 mins
    if (typeof window === 'undefined') return;
    setInterval(() => this.sync(), intervalMs);
  }
}
