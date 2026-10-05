import { describe, expect, it } from 'vitest'
import { getSpeciesAdvice } from './speciesAdvisor'

const missingConditions = {
  water_temp_c: null,
  pressure_hpa: null,
  wind_speed_ms: null,
  dissolved_oxygen_mgl: null,
  is_daytime: true,
  solunar_score: 50,
}

describe('getSpeciesAdvice', () => {
  it('does not infer cold-water tactics or unfavorable readings when conditions are unknown', () => {
    const advice = getSpeciesAdvice('Largemouth Bass', missingConditions)

    expect(advice.activityScore).toBe(50)
    expect(advice.technique).toContain('Water temperature unavailable')
    expect(advice.depthAdvice).toContain('Water temperature unavailable')
    expect(advice.reasoning).toContain('Pressure unavailable; no pressure adjustment applied.')
    expect(advice.reasoning).toContain('Dissolved oxygen unavailable; no oxygen adjustment applied.')
    expect(advice.reasoning).not.toContain('Low or falling pressure — fish may be sluggish')
  })

  it('does not describe a pressure reading as falling when no trend was supplied', () => {
    const advice = getSpeciesAdvice('Largemouth Bass', {
      ...missingConditions,
      pressure_hpa: 1000,
    })

    expect(advice.reasoning).toContain('Pressure is below the advisor threshold; no pressure trend is available.')
    expect(advice.reasoning.join(' ')).not.toContain('falling pressure')
  })
})
