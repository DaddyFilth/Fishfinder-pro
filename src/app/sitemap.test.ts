import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import sitemap from './sitemap'

describe('sitemap metadata route', () => {
  it('contains the public directory and detail routes on the canonical host', () => {
    const entries = sitemap()
    const urls = entries.map((entry) => entry.url)
    expect(urls).toContain('https://www.fishfinder-pro.online')
    expect(urls).toContain('https://www.fishfinder-pro.online/fishing-spots')
    expect(urls).toContain('https://www.fishfinder-pro.online/species')
    expect(urls.some((url) => url.includes('/fishing-spots/lake-hefner'))).toBe(true)
    expect(urls.some((url) => url.includes('/species/largemouth-bass'))).toBe(true)
    expect(entries.find((entry) => entry.url === 'https://www.fishfinder-pro.online')?.changeFrequency).toBe('daily')
    expect(entries.find((entry) => entry.url === 'https://www.fishfinder-pro.online')?.priority).toBe(1)
  })

  it('is not shadowed by a static public/sitemap.xml file', () => {
    // A file at public/sitemap.xml wins over this route, so the live sitemap
    // froze at the committed lastmod instead of regenerating per deploy.
    const staticCopy = resolve(process.cwd(), 'public/sitemap.xml')

    expect(() => readFileSync(staticCopy, 'utf8')).toThrow()
  })
})
