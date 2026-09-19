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
})
