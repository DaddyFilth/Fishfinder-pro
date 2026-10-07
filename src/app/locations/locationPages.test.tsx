import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import LocationsPage from './page'
import LocationPage, { generateMetadata, generateStaticParams } from './[slug]/page'
import { PUBLIC_LOCATIONS } from '@/lib/publicCatalog'

describe('public location pages', () => {
  it('renders a crawlable directory with links and source context', () => {
    const markup = renderToStaticMarkup(<LocationsPage />)

    expect(markup).toContain('Oklahoma public fishing locations')
    expect(markup).toContain('Source: Bundled Oklahoma public-water catalog')
    expect(markup).toContain('/locations/lake-hefner')
    expect(markup).toContain('not live access reports')
  })

  it('statically generates only catalog-backed locations', () => {
    const params = generateStaticParams()

    expect(params).toHaveLength(PUBLIC_LOCATIONS.length)
    expect(params).toContainEqual({ slug: 'lake-hefner' })
    expect(new Set(params.map(({ slug }) => slug)).size).toBe(params.length)
  })

  it('renders unique catalog notes, coordinates, provenance, and canonical metadata', async () => {
    const params = Promise.resolve({ slug: 'lake-hefner' })
    const markup = renderToStaticMarkup(await LocationPage({ params }))
    const metadata = await generateMetadata({ params })

    expect(markup).toContain('Lake Hefner')
    expect(markup).toContain('35.588, -97.588')
    expect(markup).toContain('Bundled Oklahoma public-water catalog')
    expect(markup).toContain('not live access or environmental measurements')
    expect(metadata.alternates?.canonical).toBe('/locations/lake-hefner')
  })
})
