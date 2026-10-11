import type { MetadataRoute } from 'next'
import { DEFAULT_SPOTS } from '@/lib/defaultSpots'
import { SPECIES } from '@/lib/speciesCatalog'
import { speciesSlug, spotSlug } from '@/lib/publicSeo'
const base = 'https://www.fishfinder-pro.online'
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: base, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/fishing-spots`, changeFrequency: 'weekly', priority: 0.9 },
    ...DEFAULT_SPOTS.map((spot) => ({
      url: `${base}/fishing-spots/${spotSlug(spot)}`,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
    ...DEFAULT_SPOTS.map((spot) => ({
      url: `${base}/fishing-spots/${spotSlug(spot)}/ai`,
      changeFrequency: 'daily' as const,
      priority: 0.65,
    })),
    { url: `${base}/species`, changeFrequency: 'monthly', priority: 0.8 },
    ...SPECIES.map((species) => ({
      url: `${base}/species/${speciesSlug(species)}`,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
  ]
}
