import { DEFAULT_SPOTS } from '@/lib/defaultSpots'
import { SPECIES } from '@/lib/speciesCatalog'
import type { Spot } from '@/lib/mapFilters'
import type { Species } from '@/lib/speciesCatalog'

export type PublicSpot = Spot & { slug: string }

export function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function buildPublicSpots(spots: readonly Spot[]): PublicSpot[] {
  const counts = new Map<string, number>()
  return spots.map((spot) => {
    const baseSlug = slugify(spot.name)
    const count = (counts.get(baseSlug) ?? 0) + 1
    counts.set(baseSlug, count)
    return {
      ...spot,
      slug: count === 1 ? baseSlug : `${baseSlug}-${count}`,
    }
  })
}

export const PUBLIC_SPOTS: PublicSpot[] = buildPublicSpots(DEFAULT_SPOTS)

const spotSlugById = new Map<string, string>(
  PUBLIC_SPOTS.map((spot) => [spot.id, spot.slug]),
)

const spotBySlug = new Map<string, PublicSpot>(
  PUBLIC_SPOTS.map((spot) => [spot.slug, spot]),
)

export function spotSlug(spot: Pick<Spot, 'name'> & { id?: string }): string {
  if (spot.id) {
    const known = spotSlugById.get(spot.id)
    if (known) return known
  }
  return slugify(spot.name)
}

export function speciesSlug(species: Pick<Species, 'id' | 'name'>): string {
  return slugify(species.id || species.name)
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export function findSpotBySlug(slug: string): PublicSpot | undefined {
  const decoded = safeDecode(slug)
  const normalizedSlug = slugify(decoded)
  if (!normalizedSlug) return undefined
  return spotBySlug.get(normalizedSlug)
}

export function findSpeciesBySlug(slug: string): Species | undefined {
  const decoded = safeDecode(slug)
  const normalizedSlug = slugify(decoded)
  if (!normalizedSlug) return undefined
  return SPECIES.find(
    (species) => species.id === decoded || speciesSlug(species) === normalizedSlug,
  )
}

export const publicSpotSlugs = PUBLIC_SPOTS.map((spot) => spot.slug)
export const publicSpeciesSlugs = SPECIES.map(speciesSlug)

export const catalogSourceLabel = 'Bundled Oklahoma public-water catalog'
export const catalogSourceUrl = 'https://oklahoma.gov/owrb/data-and-maps/bathymetric-mapping.html'
export const speciesSourceLabel = 'Oklahoma species reference catalog'
