import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import sitemap from './sitemap'
import { PUBLIC_SPOTS } from '@/lib/publicSeo'
import { SPECIES } from '@/lib/speciesCatalog'
import { isPublicPath, resolveLegacyLocationRedirect } from '@/proxy'

describe('sitemap metadata route', () => {
  it('contains canonical public pages on the canonical host without duplicate /locations URLs', () => {
    const entries = sitemap()
    const urls = entries.map(({ url }) => url)

    expect(entries).toHaveLength(5 + PUBLIC_SPOTS.length + SPECIES.length)
    expect(new Set(urls).size).toBe(urls.length)
    expect(entries[0]?.url).toBe('https://www.fishfinder-pro.online')
    expect(entries[0]?.changeFrequency).toBe('daily')
    expect(entries[0]?.priority).toBe(1)

    expect(urls).toContain('https://www.fishfinder-pro.online/fishing-spots')
    expect(urls).toContain('https://www.fishfinder-pro.online/species')
    expect(urls).toContain('https://www.fishfinder-pro.online/privacy')
    expect(urls).toContain('https://www.fishfinder-pro.online/terms')
    expect(urls.some((url) => url.includes('/locations'))).toBe(false)

    for (const spot of PUBLIC_SPOTS) {
      expect(urls).toContain(`https://www.fishfinder-pro.online/fishing-spots/${spot.slug}`)
    }
    for (const species of SPECIES) {
      expect(urls).toContain(`https://www.fishfinder-pro.online/species/${species.id}`)
    }
    expect(
      entries.every(({ url }) =>
        url === 'https://www.fishfinder-pro.online' || url.startsWith('https://www.fishfinder-pro.online/'),
      ),
    ).toBe(true)
  })

  it('guarantees every sitemap URL is directly public in proxy and never redirects to /auth/login or /locations', () => {
    const entries = sitemap()
    for (const { url } of entries) {
      const { pathname } = new URL(url)
      expect(isPublicPath(pathname), `Sitemap path ${pathname} must be public`).toBe(true)
      expect(resolveLegacyLocationRedirect(pathname), `Sitemap path ${pathname} must not redirect`).toBeNull()
    }
  })

  it('is not shadowed by a static public/sitemap.xml file', () => {
    const staticCopy = resolve(process.cwd(), 'public/sitemap.xml')
    expect(() => readFileSync(staticCopy, 'utf8')).toThrow()
  })
})
