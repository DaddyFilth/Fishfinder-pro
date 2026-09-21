import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import MobilePage from './page'

vi.mock('next/dynamic', () => ({
  default: () => () => null,
}))

vi.mock('@/components/NextBestAction', () => ({ default: () => null }))
vi.mock('@/components/SpeciesTab', () => ({ default: () => null }))
vi.mock('@/components/BiteTimesTab', () => ({ default: () => null }))
vi.mock('@/components/WeatherTab', () => ({ default: () => null }))
vi.mock('@/components/logbook/LogbookTab', () => ({ default: () => null }))
vi.mock('@/components/logbook/PhotoGalleryTab', () => ({ default: () => null }))
vi.mock('@/components/ai/SpotSuggester', () => ({ default: () => null }))
vi.mock('@/components/AuthAccountButton', () => ({ default: () => null }))

describe('MobilePage hydration guard', () => {
  it('renders no browser-dependent markup before the component mounts', () => {
    expect(renderToStaticMarkup(<MobilePage />)).toBe('')
  })
})
