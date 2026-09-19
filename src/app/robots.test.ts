import { describe, expect, it } from 'vitest'
import robots from './robots'

describe('robots metadata route', () => {
  it('allows public crawling while blocking private/authenticated areas', () => {
    const result = robots()
    const rules = Array.isArray(result.rules) ? result.rules[0] : result.rules

    expect(rules.userAgent).toBe('*')
    expect(rules.allow).toBe('/')
    expect(rules.disallow).toEqual(['/account', '/admin', '/api/', '/auth/'])
    expect(result.sitemap).toBe('https://www.fishfinder-pro.online/sitemap.xml')
  })
})
