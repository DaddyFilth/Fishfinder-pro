import { describe, expect, it } from 'vitest'
import { hourlyActivityForecast, type SolunarResult } from './solunar'

function solunarFixture(overrides: Partial<SolunarResult> = {}): SolunarResult {
  return {
    moonPhase: '0',
    moonIllumination: 0,
    moonPhaseName: 'New Moon',
    majorPeriods: [{ start: '11:00 PM', end: '01:00 AM' }],
    minorPeriods: [{ start: '11:00 AM', end: '01:00 PM' }],
    solunarScore: 50,
    bestHours: [],
    peakActivityLabel: 'Lower Solunar Potential',
    ...overrides,
  }
}

describe('hourlyActivityForecast', () => {
  it('interprets 12-hour periods as the correct 24-hour hours', () => {
    const forecast = hourlyActivityForecast(solunarFixture())

    expect(forecast[23].label).toBe('Major')
    expect(forecast[0].label).toBe('Major')
    expect(forecast[1].label).toBe('Major')
    expect(forecast[11].label).toBe('Minor')
    expect(forecast[12].label).toBe('Minor')
    expect(forecast[13].label).toBe('Minor')
    expect(forecast[14].label).toBe('Slow')
  })

  it('treats periods that cross midnight as one continuous window', () => {
    const forecast = hourlyActivityForecast(solunarFixture({
      majorPeriods: [{ start: '23:00', end: '01:00' }],
      minorPeriods: [],
    }))

    expect(forecast[23].label).toBe('Major')
    expect(forecast[0].label).toBe('Major')
    expect(forecast[1].label).toBe('Major')
    expect(forecast[2].label).toBe('Slow')
  })
})
