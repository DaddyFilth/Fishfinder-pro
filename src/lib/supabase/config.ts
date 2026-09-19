function firstDefined(candidates: Array<string | undefined>) {
  return candidates.find((value) => Boolean(value?.trim()))?.trim()
}

function normalizeSupabaseUrl(value: string | undefined) {
  if (!value) return null

  try {
    const parsed = new URL(value)
    if (!['http:', 'https:'].includes(parsed.protocol)) return null
    return parsed.origin
  } catch {
    return null
  }
}

export function getSupabaseProjectUrl() {
  const explicit = firstDefined([
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_URL,
  ])

  return normalizeSupabaseUrl(explicit)
}

export function getSupabasePublishableKey() {
  return firstDefined([
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    process.env.SUPABASE_PUBLISHABLE_KEY,
    process.env.SUPABASE_ANON_KEY,
  ])
}

export function getSupabaseServiceRoleKey() {
  return firstDefined([
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    process.env.SUPABASE_SECRET_KEY,
  ])
}
