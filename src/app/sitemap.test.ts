import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import sitemap from './sitemap'
import { PUBLIC_LOCATIONS } from '@/lib/publicCatalog'
import { SPECIES } from '@/lib/speciesCatalog'

describe('sitemap metadata route', () => {
  it('contains public directories and catalog detail pages on the canonical host', () => {
    const entries = sitemap()
    expect(entries).toHaveLength(4 + PUBLIC_LOCATIONS.length + SPECIES.length)
    expect(entries[0]?.url).toBe('https://www.fishfinder-pro.online')
    expect(entries[0]?.changeFrequency).toBe('daily')
    expect(entries[0]?.priority).toBe(1)
    expect(entries.map(({ url }) => url)).toContain('https://www.fishfinder-pro.online/locations')
    expect(entries.map(({ url }) => url)).toContain('https://www.fishfinder-pro.online/species')
    for (const location of PUBLIC_LOCATIONS) {
      expect(entries.map(({ url }) => url)).toContain(`https://www.fishfinder-pro.online/locations/${location.slug}`)
    }
    for (const species of SPECIES) {
      expect(entries.map(({ url }) => url)).toContain(`https://www.fishfinder-pro.online/species/${species.id}`)
    }
    expect(entries.every(({ url }) => url.startsWith('https://www.fishfinder-pro.online/'))).toBe(true)
  })

  it('is not shadowed by a static public/sitemap.xml file', () => {
    // A file at public/sitemap.xml wins over this route, so the live sitemap
    // froze at the committed lastmod instead of regenerating per deploy.
    const staticCopy = resolve(process.cwd(), 'public/sitemap.xml')

    expect(() => readFileSync(staticCopy, 'utf8')).toThrow()
  })
})
