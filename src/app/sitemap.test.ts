import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import sitemap from './sitemap'

describe('sitemap metadata route', () => {
  it('contains only live public routes on canonical host', () => {
    const entries = sitemap()
    expect(entries).toHaveLength(1)
    expect(entries[0]?.url).toBe('https://www.fishfinder-pro.online')
    expect(entries[0]?.changeFrequency).toBe('daily')
    expect(entries[0]?.priority).toBe(1)
  })

  it('is not shadowed by a static public/sitemap.xml file', () => {
    // A file at public/sitemap.xml wins over this route, so the live sitemap
    // froze at the committed lastmod instead of regenerating per deploy.
    const staticCopy = resolve(process.cwd(), 'public/sitemap.xml')

    expect(() => readFileSync(staticCopy, 'utf8')).toThrow()
  })
})
