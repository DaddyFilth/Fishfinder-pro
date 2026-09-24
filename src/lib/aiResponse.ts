import { z } from 'zod'

const HOUR_MINUTE = /^([01]\d|2[0-3]):[0-5]\d$/

type TimeWindow = {
  start: string
  end: string
}

function minutesSinceMidnight(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

function hasValidBiteWindows(windows: TimeWindow[]): boolean {
  return windows.every((window, index) => {
    const start = minutesSinceMidnight(window.start)
    const end = minutesSinceMidnight(window.end)
    const startsBeforeItEnds = start < end || (start === 0 && end > 0)
    const followsPrevious = index === 0 || minutesSinceMidnight(windows[index - 1].end) <= start
    return startsBeforeItEnds && followsPrevious
  })
}

export const AnalysisSchema = z.object({
  summary: z.string().trim().min(1).max(600),
  emoji_rating: z.string().trim().min(1).max(40),
})

export const BiteTimeWindowSchema = z.object({
  start: z.string().regex(HOUR_MINUTE),
  end: z.string().regex(HOUR_MINUTE),
  quality: z.enum(['Peak', 'Good', 'Fair']),
  score: z.number().int().min(0).max(100),
  reason: z.string().trim().min(1).max(300),
  recommended_bait: z.string().trim().min(1).max(120),
  depth: z.string().trim().min(1).max(120),
})

export const BiteTimesSchema = z.object({
  overall_rating: z.enum(['Excellent', 'Good', 'Fair', 'Slow']),
  overall_score: z.number().int().min(0).max(100),
  summary: z.string().trim().min(1).max(400),
  windows: z
    .array(BiteTimeWindowSchema)
    .length(3)
    .refine(hasValidBiteWindows, 'Bite windows must be valid, chronological, and non-overlapping.'),
  avoid_times: z.string().trim().min(1).max(300),
  pro_tip: z.string().trim().min(1).max(300),
})

export const FishIdentificationSchema = z.object({
  species: z.string().trim().min(1).max(120),
  scientific_name: z.string().trim().min(1).max(160),
  confidence: z.number().min(0).max(1),
  size_estimate: z.string().trim().max(120),
  weight_estimate: z.string().trim().max(120),
  distinguishing_features: z.array(z.string().trim().min(1).max(200)).max(8),
  habitat: z.string().trim().min(1).max(300),
  best_baits: z.array(z.string().trim().min(1).max(120)).max(8),
  fun_fact: z.string().trim().min(1).max(400),
  legal_notes: z.string().trim().min(1).max(300),
  is_fish: z.literal(true),
})

export const NoFishSchema = z.object({ is_fish: z.literal(false) })

export const SpotPredictionsSchema = z.array(
  z.object({
    spot_name: z.string().trim().min(1).max(200),
    fishing_score: z.number().int().min(0).max(100),
    rating: z.enum(['Hot', 'Good', 'Fair']),
    primary_species: z.array(z.string().trim().min(1).max(120)).min(1).max(3),
    best_time_today: z.string().trim().min(1).max(120),
    best_technique: z.string().trim().min(1).max(240),
    recommended_lure: z.string().trim().min(1).max(120),
    reason: z.string().trim().min(1).max(400),
  }),
).max(10)

export type SpotPrediction = z.infer<typeof SpotPredictionsSchema>[number]

export function cleanModelJson(content: string): string {
  return content
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
}

export function parseModelJson<T>(content: string, schema: z.ZodType<T>): T {
  const parsed = schema.safeParse(JSON.parse(cleanModelJson(content)))
  if (!parsed.success) {
    throw new Error('The AI response did not match the expected schema.')
  }
  return parsed.data
}

export function parseFishIdentification(content: string) {
  const raw: unknown = JSON.parse(cleanModelJson(content))
  if (raw && typeof raw === 'object' && 'is_fish' in raw) {
    const record = raw as Record<string, unknown>
    if (record.is_fish === false) return NoFishSchema.parse(record)
  }
  return FishIdentificationSchema.parse(raw)
}
