import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import SpeciesPage from './page'
import SpeciesDetailPage, { generateMetadata, generateStaticParams } from './[slug]/page'
import { SPECIES } from '@/lib/speciesCatalog'

describe('public species pages', () => {
  it('renders a crawlable directory with source context and detail links', () => {
    const markup = renderToStaticMarkup(<SpeciesPage />)

    expect(markup).toContain('Oklahoma fish species guide')
    expect(markup).toContain('Source: Oklahoma SeamCast species catalog')
    expect(markup).toContain('/species/largemouth-bass')
    expect(markup).toContain('not live sightings')
  })

  it('statically generates only Oklahoma catalog species', () => {
    const params = generateStaticParams()

    expect(params).toHaveLength(SPECIES.length)
    expect(params).toContainEqual({ slug: 'largemouth-bass' })
    expect(new Set(params.map(({ slug }) => slug)).size).toBe(params.length)
  })

  it('renders species-specific guidance and canonical metadata', async () => {
    const params = Promise.resolve({ slug: 'largemouth-bass' })
    const markup = renderToStaticMarkup(await SpeciesDetailPage({ params }))
    const metadata = await generateMetadata({ params })

    expect(markup).toContain('Largemouth Bass')
    expect(markup).toContain('Micropterus salmoides')
    expect(markup).toContain('Weeds, structure, and docks')
    expect(markup).toContain('not a live sighting')
    expect(metadata.alternates?.canonical).toBe('/species/largemouth-bass')
  })
})
