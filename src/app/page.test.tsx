import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/dynamic', () => ({
  default: () => function MockDynamicComponent() {
    return <div data-testid="dynamic-component" />
  },
}))

vi.mock('@/components/NextBestAction', () => ({ default: () => null }))
vi.mock('@/components/SpeciesTab', () => ({ default: () => null }))
vi.mock('@/components/BiteTimesTab', () => ({ default: () => null }))
vi.mock('@/components/WeatherTab', () => ({ default: () => null }))
vi.mock('@/components/logbook/LogbookTab', () => ({ default: () => null }))
vi.mock('@/components/logbook/PhotoGalleryTab', () => ({ default: () => null }))
vi.mock('@/components/ai/SpotSuggester', () => ({ default: () => null }))
vi.mock('@/components/AuthAccountButton', () => ({ default: () => null }))

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => null),
}))

describe('MobilePage hydration guard', () => {
  it('renders no client-dependent markup before the component mounts', async () => {
    const { default: MobilePage } = await import('./page')

    expect(renderToStaticMarkup(<MobilePage />)).toBe('')
  })
})
