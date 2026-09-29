export interface CommunitySpot {
  id: string;
  speciesId: string;
  speciesName: string;
  regionName: string;
  viability: number;
  reportedAt: string;
  isGhostSpot: boolean; // If true, coordinates are hidden
  lat?: number;
  lng?: number;
}

export const COMMUNITY_STORE = 'community_spots';
