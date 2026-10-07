import { describe, expect, it } from 'vitest'
import { DEFAULT_SPOTS } from '@/lib/defaultSpots'
import { SPECIES } from '@/lib/speciesCatalog'
import { findSpeciesBySlug, findSpotBySlug, publicSpeciesSlugs, publicSpotSlugs, speciesSlug, spotSlug } from '@/lib/publicSeo'

describe('public SEO catalog routes', () => {
  it('creates a unique route for every public spot', () => {
    expect(publicSpotSlugs).toHaveLength(DEFAULT_SPOTS.length)
    expect(new Set(publicSpotSlugs).size).toBe(DEFAULT_SPOTS.length)
    for (const spot of DEFAULT_SPOTS) expect(findSpotBySlug(spotSlug(spot))?.id).toBe(spot.id)
  })

  it('creates a unique route for every Oklahoma species', () => {
    expect(publicSpeciesSlugs).toHaveLength(SPECIES.length)
    expect(new Set(publicSpeciesSlugs).size).toBe(SPECIES.length)
    for (const species of SPECIES) expect(findSpeciesBySlug(speciesSlug(species))?.id).toBe(species.id)
  })

  it('does not resolve unknown public routes', () => {
    expect(findSpotBySlug('not-a-real-water')).toBeUndefined()
    expect(findSpeciesBySlug('not-a-real-species')).toBeUndefined()
  })
})
