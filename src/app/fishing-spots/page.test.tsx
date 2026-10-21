import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import FishingSpotsIndexPage from './page'

describe('fishing spots directory', () => {
  it('renders a search form for filtering the catalog', async () => {
    const markup = renderToStaticMarkup(
      await FishingSpotsIndexPage({ searchParams: Promise.resolve({}) }),
    )

    expect(markup).toContain('role="search"')
    expect(markup).toContain('name="query"')
    expect(markup).toContain('Showing 76 of 76 public waters.')
  })

  it('filters the catalog by the submitted query', async () => {
    const markup = renderToStaticMarkup(
      await FishingSpotsIndexPage({ searchParams: Promise.resolve({ query: 'Thunderbird' }) }),
    )

    expect(markup).toContain('value="Thunderbird"')
    expect(markup).toContain('Showing 1 of 76 public waters.')
    expect(markup).toContain('Lake Thunderbird')
    expect(markup).not.toContain('Lake Hefner')
    expect(markup).toContain('Clear search')
  })
})
