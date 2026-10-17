import type { MetadataRoute } from 'next'
import { PUBLIC_LOCATIONS } from '@/lib/publicCatalog'
import { DEFAULT_SPOTS } from '@/lib/defaultSpots'
import { SPECIES } from '@/lib/speciesCatalog'
import { spotSlug } from '@/lib/publicSeo'

const base = 'https://www.fishfinder-pro.online'
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()
  return [
    { url: base, lastModified, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/locations`, lastModified, changeFrequency: 'weekly', priority: 0.8 },
    ...PUBLIC_LOCATIONS.map(({ slug }) => ({
      url: `${base}/locations/${slug}`,
      lastModified,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
    { url: `${base}/fishing-spots`, lastModified, changeFrequency: 'weekly' as const, priority: 0.8 },
    ...DEFAULT_SPOTS.map((spot) => ({
      url: `${base}/fishing-spots/${spotSlug(spot)}`,
      lastModified,
      changeFrequency: 'daily' as const,
      priority: 0.65,
    })),
    { url: `${base}/species`, lastModified, changeFrequency: 'weekly', priority: 0.8 },
    ...SPECIES.map(({ id }) => ({
      url: `${base}/species/${id}`,
      lastModified,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
  ]
}
