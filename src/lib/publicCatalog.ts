import {
  PUBLIC_SPOTS,
  findSpeciesBySlug,
  findSpotBySlug,
  type PublicSpot,
} from '@/lib/publicSeo'

export type PublicLocation = PublicSpot

export const PUBLIC_LOCATIONS: PublicLocation[] = PUBLIC_SPOTS

export function findPublicLocation(slug: string) {
  return findSpotBySlug(slug)
}

export function findPublicSpecies(slug: string) {
  return findSpeciesBySlug(slug)
}
