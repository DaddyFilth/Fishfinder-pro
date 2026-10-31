import { describe, expect, it, vi } from 'vitest'
import { PUBLIC_LOCATIONS, findPublicLocation } from '@/lib/publicCatalog'
import { PUBLIC_SPOTS } from '@/lib/publicSeo'

const permanentRedirectMock = vi.fn((url: string): never => {
  throw new Error(`NEXT_REDIRECT:308:${url}`)
})
const notFoundMock = vi.fn((): never => {
  throw new Error('NEXT_NOT_FOUND')
})

vi.mock('next/navigation', () => ({
  permanentRedirect: (url: string) => permanentRedirectMock(url),
  notFound: () => notFoundMock(),
}))

const { default: LocationsPage } = await import('./page')
const { default: LocationPage, generateStaticParams } = await import('./[slug]/page')

describe('legacy /locations canonical redirects and unified catalog', () => {
  it('shares the exact same catalog array and slugs as PUBLIC_SPOTS so they cannot drift', () => {
    expect(PUBLIC_LOCATIONS).toBe(PUBLIC_SPOTS)
    expect(findPublicLocation('lake-hefner')?.slug).toBe('lake-hefner')
  })

  it('308-redirects /locations to /fishing-spots', () => {
    expect(() => LocationsPage()).toThrow('NEXT_REDIRECT:308:/fishing-spots')
  })

  it('statically generates catalog slugs and 308-redirects /locations/[slug] to /fishing-spots/[slug]', async () => {
    const params = generateStaticParams()
    expect(params).toHaveLength(PUBLIC_LOCATIONS.length)
    expect(params).toContainEqual({ slug: 'lake-hefner' })

    await expect(LocationPage({ params: Promise.resolve({ slug: 'lake-hefner' }) })).rejects.toThrow(
      'NEXT_REDIRECT:308:/fishing-spots/lake-hefner',
    )
    await expect(LocationPage({ params: Promise.resolve({ slug: 'unknown-water' }) })).rejects.toThrow(
      'NEXT_NOT_FOUND',
    )
  })
})
