import type { MetadataRoute } from 'next'
const base = 'https://www.fishfinder-pro.online'
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: base, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
  ]
}
