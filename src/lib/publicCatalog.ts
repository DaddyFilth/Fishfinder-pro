import { DEFAULT_SPOTS } from '@/lib/defaultSpots'
import { SPECIES } from '@/lib/speciesCatalog'

function slugify(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

const slugCounts = new Map<string, number>()

export const PUBLIC_LOCATIONS = DEFAULT_SPOTS.map((spot) => {
  const baseSlug = slugify(spot.name)
  const count = (slugCounts.get(baseSlug) ?? 0) + 1
  slugCounts.set(baseSlug, count)

  return { ...spot, slug: count === 1 ? baseSlug : `${baseSlug}-${count}` }
})

export function findPublicLocation(slug: string) {
  return PUBLIC_LOCATIONS.find((location) => location.slug === slug)
}

export function findPublicSpecies(slug: string) {
  return SPECIES.find((species) => species.id === slug)
}
