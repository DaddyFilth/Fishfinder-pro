import { z } from 'zod'

const SpotRecordSchema = z.object({
  id: z.string(),
  name: z.string(),
  lat: z.number(),
  lng: z.number(),
  water_type: z.string(),
  spot_type: z.string(),
  live: z.boolean().optional(),
  data_mode: z.enum(['provider', 'cached', 'stale-cache', 'fallback', 'unavailable', 'ai-generated']).optional(),
}).passthrough()

export const SpotApiPayloadSchema = z.object({
  spots: z.array(SpotRecordSchema),
  data_mode: z.enum(['provider', 'cached', 'stale-cache', 'fallback', 'unavailable', 'ai-generated']).optional(),
  source: z.string().optional(),
  live: z.boolean().optional(),
  observed_at: z.string().optional(),
}).passthrough()

export type SpotApiPayload = z.infer<typeof SpotApiPayloadSchema>

export function parseSpotApiPayload(value: unknown): SpotApiPayload | null {
  const parsed = SpotApiPayloadSchema.safeParse(value)
  if (!parsed.success) return null

  const dataMode = parsed.data.data_mode ?? 'provider'
  return {
    ...parsed.data,
    data_mode: dataMode,
    live: false,
    spots: parsed.data.spots.map((spot) => ({
      ...spot,
      live: false,
      data_mode: spot.data_mode ?? dataMode,
    })),
  }
}

/** Convert an arbitrary provider response into a safe, non-live fallback list. */
export function normalizeProviderSpots(value: unknown, fallback: readonly { id: string; name: string; lat: number; lng: number; water_type: string; spot_type: string }[]): SpotApiPayload {
  const parsed = parseSpotApiPayload(value)
  // A provider payload with zero usable spots is not a live dataset; let the
  // normalization branch decide so we can fall back to the local catalog.
  if (parsed && parsed.spots.length > 0) return parsed

  const root = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  // Seamcast's feed exposes provider pins in `microSpots` when it has no
  // named spot rows. Surface them as real provider spots rather than falling
  // back, so the client reads upstream data instead of the local catalog.
  const rawSpots = Array.isArray(root.spots) && root.spots.length > 0
    ? root.spots
    : Array.isArray(root.microSpots) && root.microSpots.length > 0
      ? root.microSpots
      : Array.isArray(value) && value.length > 0
        ? value
        : []
  const spots = rawSpots
    .filter((spot): spot is Record<string, unknown> => Boolean(spot && typeof spot === 'object'))
    .map((spot, index) => ({
      ...spot,
      id: typeof spot.id === 'string' ? spot.id : `provider-${index}`,
      name: typeof spot.name === 'string'
        ? spot.name
        : typeof spot.label === 'string'
          ? spot.label
          : '',
      lat: Number(spot.lat ?? spot.latitude),
      lng: Number(spot.lng ?? spot.lon ?? spot.longitude),
      water_type: typeof spot.water_type === 'string' ? spot.water_type : 'freshwater',
      spot_type: typeof spot.spot_type === 'string' ? spot.spot_type : 'fishing spot',
      source: 'seamcast-spots',
      live: false as const,
      data_mode: 'provider' as const,
    }))
    .filter((spot) => spot.name && Number.isFinite(spot.lat) && Number.isFinite(spot.lng));

  return {
    spots: spots.length > 0 ? spots : fallback.map((spot) => ({
      ...spot,
      source: 'verified-public-water-catalog',
      live: false as const,
      data_mode: 'fallback' as const,
    })),
    data_mode: spots.length > 0 ? 'provider' : 'fallback',
    source: spots.length > 0 ? 'seamcast-spots' : 'verified-public-water-catalog',
    live: false,
  }
}
