import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../fetchers/environmental', () => ({
  fetchPressureTrend: vi.fn(),
}))

import { fetchPressureTrend } from '../fetchers/environmental'
import { EnvironmentManager } from './manager'

describe('EnvironmentManager.getBarometricTrend', () => {
  beforeEach(() => {
    vi.mocked(fetchPressureTrend).mockReset().mockResolvedValue(null)
  })

  it('keeps unavailable pressure distinct from a measured zero', async () => {
    const result = await EnvironmentManager.getBarometricTrend(84.123, -121.456)

    expect(result).toMatchObject({
      currentPressure: null,
      trend: 'unavailable',
      advice: 'Pressure data is unavailable at this location right now.',
    })
  })
})
