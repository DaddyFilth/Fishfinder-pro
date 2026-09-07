import { DEFAULT_SPOTS } from '@/lib/defaultSpots';

/**
 * Nationwide starter catalog for Supabase seeding.
 * The local fallback and database seed intentionally share stable IDs so the
 * API can merge database rows without creating duplicate map pins.
 */
export const NATIONWIDE_SPOTS = DEFAULT_SPOTS.map((spot) => ({ ...spot }));

// Kept as a compatibility alias for existing seed scripts.
export const OKLAHOMA_SPOTS = NATIONWIDE_SPOTS;

export default NATIONWIDE_SPOTS;
