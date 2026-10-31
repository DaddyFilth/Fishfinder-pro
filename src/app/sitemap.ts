import type { MetadataRoute } from 'next'
import { PUBLIC_SPOTS } from '@/lib/publicSeo'
import { SPECIES } from '@/lib/speciesCatalog'

const base = 'https://www.fishfinder-pro.online'

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()
  return [
    { url: base, lastModified, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/fishing-spots`, lastModified, changeFrequency: 'weekly', priority: 0.8 },
    ...PUBLIC_SPOTS.map(({ slug }) => ({
      url: `${base}/fishing-spots/${slug}`,
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
    { url: `${base}/privacy`, lastModified, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/terms`, lastModified, changeFrequency: 'yearly', priority: 0.3 },
  ]
}
