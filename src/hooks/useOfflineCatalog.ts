import { useState, useEffect } from 'react';
import { StorageManager } from '@/lib/storage';
import { SPECIES, type Species } from '@/lib/speciesCatalog';

export function useOfflineCatalog() {
  const [isSynced, setIsSynced] = useState(false);

  useEffect(() => {
    async function syncCatalog() {
      try {
        // Store the entire catalog in IndexedDB for offline access
        for (const species of SPECIES) {
          await StorageManager.set('CATALOG', species.id, species);
        }
        setIsSynced(true);
      } catch (e) {
        console.error('Catalog sync failed:', e);
      }
    }
    syncCatalog();
  }, []);

  return { isSynced };
}
