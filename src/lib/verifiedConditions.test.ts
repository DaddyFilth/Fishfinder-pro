import { describe, expect, it } from 'vitest'
import { hasVerifiedCurrentConditions } from './verifiedConditions'

describe('hasVerifiedCurrentConditions', () => {
  const now = Date.parse('2026-10-05T12:00:00.000Z')

  it('accepts explicitly live provider conditions with a recent observation time', () => {
    expect(hasVerifiedCurrentConditions({
      live: true,
      data_mode: 'provider',
      observed_at: '2026-10-05T11:45:00.000Z',
    }, now)).toBe(true)
  })

  it('rejects cached, missing, stale, or future-dated conditions', () => {
    expect(hasVerifiedCurrentConditions({
      live: true,
      data_mode: 'cached',
      observed_at: '2026-10-05T11:45:00.000Z',
    }, now)).toBe(false)
    expect(hasVerifiedCurrentConditions({ live: true, data_mode: 'provider' }, now)).toBe(false)
    expect(hasVerifiedCurrentConditions({
      live: true,
      data_mode: 'provider',
      observed_at: '2026-10-05T11:00:00.000Z',
    }, now)).toBe(false)
    expect(hasVerifiedCurrentConditions({
      live: true,
      data_mode: 'provider',
      observed_at: '2026-10-05T12:05:00.000Z',
    }, now)).toBe(false)
  })
})
