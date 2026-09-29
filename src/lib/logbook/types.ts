export interface Catch {
  id: string;
  speciesId: string;
  speciesName: string;
  weight: number;
  length: number;
  date: string;
  coordinates: { lat: number; lng: number };
  lure: string;
  condition: string;
  photoUrl?: string;
  notes?: string;
}

export interface LogbookStats {
  totalCatches: number;
  speciesDiversity: number;
  topSpecies: string;
  successRate: number;
}

export const LOGBOOK_STORE = 'user_logbook';
