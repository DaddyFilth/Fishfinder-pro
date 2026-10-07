import { DEFAULT_SPOTS } from '@/lib/defaultSpots'
import { SPECIES } from '@/lib/speciesCatalog'
import type { Spot } from '@/lib/mapFilters'
import type { Species } from '@/lib/speciesCatalog'

export function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function spotSlug(spot: Pick<Spot, 'name'>): string {
  return slugify(spot.name)
}

export function speciesSlug(species: Pick<Species, 'id' | 'name'>): string {
  return slugify(species.id || species.name)
}

export function findSpotBySlug(slug: string): Spot | undefined {
  const normalizedSlug = slugify(decodeURIComponent(slug))
  return DEFAULT_SPOTS.find((spot) => spotSlug(spot) === normalizedSlug)
}

export function findSpeciesBySlug(slug: string): Species | undefined {
  const normalizedSlug = slugify(decodeURIComponent(slug))
  return SPECIES.find((species) => speciesSlug(species) === normalizedSlug)
}

export const publicSpotSlugs = DEFAULT_SPOTS.map(spotSlug)
export const publicSpeciesSlugs = SPECIES.map(speciesSlug)

export const catalogSourceLabel = 'Bundled Oklahoma public-water catalog'
export const catalogSourceUrl = 'https://oklahoma.gov/owrb/data-and-maps/bathymetric-mapping.html'
export const speciesSourceLabel = 'Oklahoma species reference catalog'
