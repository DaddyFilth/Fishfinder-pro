import { describe, expect, it } from 'vitest'
import {
  AnalysisSchema,
  BiteTimesSchema,
  FishIdentificationSchema,
  NoFishSchema,
  SpotPredictionsSchema,
  cleanModelJson,
  parseFishIdentification,
  parseModelJson,
} from './aiResponse'

const validBiteWindow = {
  start: '06:30',
  end: '08:00',
  quality: 'Peak' as const,
  score: 95,
  reason: 'Low light and stable pressure.',
  recommended_bait: 'Live shad',
  depth: '8–12 ft',
}

const validBiteResponse = {
  overall_rating: 'Good' as const,
  overall_score: 78,
  summary: 'A steady morning bite is likely.',
  windows: [
    validBiteWindow,
    { ...validBiteWindow, start: '10:00', end: '11:30', quality: 'Good' as const },
    { ...validBiteWindow, start: '17:00', end: '19:00', quality: 'Fair' as const },
  ],
  avoid_times: 'Midday heat.',
  pro_tip: 'Start with a slow lure.',
}

const validFishResponse = {
  species: 'Largemouth Bass',
  scientific_name: 'Micropterus salmoides',
  confidence: 0.94,
  size_estimate: '16 inches',
  weight_estimate: '2 lbs',
  distinguishing_features: ['Large mouth', 'Dark lateral band'],
  habitat: 'Warm freshwater vegetation and cover',
  best_baits: ['Spinnerbait', 'Live shad'],
  fun_fact: 'Bass use cover to ambush prey.',
  legal_notes: 'Check current local regulations.',
  is_fish: true as const,
}

describe('model JSON parsing', () => {
  it('removes a surrounding JSON code fence', () => {
    expect(cleanModelJson('```json\n{"summary":"ok","emoji_rating":"Good"}\n```')).toBe(
      '{"summary":"ok","emoji_rating":"Good"}',
    )
  })

  it('parses and validates an analysis response', () => {
    expect(
      parseModelJson(
        '```json\n{"summary":"Fish are active.","emoji_rating":"Good"}\n```',
        AnalysisSchema,
      ),
    ).toEqual({ summary: 'Fish are active.', emoji_rating: 'Good' })
  })

  it('rejects a response that does not match the supplied schema', () => {
    expect(() =>
      parseModelJson(
        JSON.stringify({ overall_rating: 'Good', overall_score: 500 }),
        BiteTimesSchema,
      ),
    ).toThrow('The AI response did not match the expected schema.')
  })
})

describe('bite response schema', () => {
  it('requires three chronological, non-overlapping windows', () => {
    expect(BiteTimesSchema.safeParse(validBiteResponse).success).toBe(true)
    expect(
      BiteTimesSchema.safeParse({
        ...validBiteResponse,
        windows: [
          { ...validBiteWindow, start: '10:00', end: '11:00' },
          { ...validBiteWindow, start: '06:30', end: '07:00' },
          validBiteWindow,
        ],
      }).success,
    ).toBe(false)
    expect(
      BiteTimesSchema.safeParse({
        ...validBiteResponse,
        windows: [
          validBiteWindow,
          { ...validBiteWindow, start: '07:30', end: '09:00' },
          { ...validBiteWindow, start: '10:00', end: '11:00' },
        ],
      }).success,
    ).toBe(false)
  })
})

describe('fish identification parsing', () => {
  it('validates a fish result and trims string fields', () => {
    const result = parseFishIdentification(
      JSON.stringify({ ...validFishResponse, species: '  Largemouth Bass  ' }),
    )
    expect(result).toEqual({ ...validFishResponse, species: 'Largemouth Bass' })
    expect(FishIdentificationSchema.safeParse(result).success).toBe(true)
  })

  it('accepts the model no-fish sentinel', () => {
    expect(parseFishIdentification('```json\n{"is_fish":false}\n```')).toEqual({ is_fish: false })
    expect(NoFishSchema.safeParse({ is_fish: false }).success).toBe(true)
  })

  it('rejects a fish result with an invalid confidence value', () => {
    expect(() =>
      parseFishIdentification(JSON.stringify({ ...validFishResponse, confidence: 1.4 })),
    ).toThrow()
  })
})

describe('spot prediction schema', () => {
  it('accepts a bounded array and rejects malformed predictions', () => {
    const prediction = {
      spot_name: 'Lake Hefner',
      fishing_score: 82,
      rating: 'Good' as const,
      primary_species: ['Largemouth Bass'],
      best_time_today: '06:30–08:00',
      best_technique: 'Work the wind-blown shoreline.',
      recommended_lure: 'Spinnerbait',
      reason: 'Open water and nearby cover favor bass.',
    }
    expect(SpotPredictionsSchema.safeParse([prediction]).success).toBe(true)
    expect(SpotPredictionsSchema.safeParse([{ ...prediction, rating: 'Excellent' }]).success).toBe(false)
    expect(SpotPredictionsSchema.safeParse([{ ...prediction, primary_species: [] }]).success).toBe(false)
  })
})
