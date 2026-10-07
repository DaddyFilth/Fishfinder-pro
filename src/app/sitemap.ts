import type { MetadataRoute } from 'next'
import { PUBLIC_LOCATIONS } from '@/lib/publicCatalog'
import { SPECIES } from '@/lib/speciesCatalog'

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
    { url: `${base}/species`, lastModified, changeFrequency: 'weekly', priority: 0.8 },
    ...SPECIES.map(({ id }) => ({
      url: `${base}/species/${id}`,
      lastModified,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
  ]
}
