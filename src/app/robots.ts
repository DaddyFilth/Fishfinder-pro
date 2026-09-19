import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/account', '/admin', '/api/', '/auth/'],
    },
    sitemap: 'https://www.fishfinder-pro.online/sitemap.xml',
    host: 'https://www.fishfinder-pro.online',
  }
}
