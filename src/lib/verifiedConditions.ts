const MAX_CONDITION_AGE_MS = 30 * 60 * 1000

export function hasVerifiedCurrentConditions(value: unknown, now = Date.now()): boolean {
  if (!value || typeof value !== 'object') return false

  const record = value as Record<string, unknown>
  const conditions = record.conditions && typeof record.conditions === 'object'
    ? record.conditions as Record<string, unknown>
    : null
  const observedAt = record.observed_at ?? conditions?.issuedAt
  if (record.live !== true || record.data_mode !== 'provider' || typeof observedAt !== 'string') {
    return false
  }

  const observedAtMs = Date.parse(observedAt)
  const ageMs = now - observedAtMs
  return Number.isFinite(observedAtMs) && ageMs >= 0 && ageMs <= MAX_CONDITION_AGE_MS
}
