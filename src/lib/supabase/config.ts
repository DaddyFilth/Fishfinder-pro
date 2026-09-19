const SUPABASE_PROJECT_REF = 'dkafqgapepebzjtoghos'
const SUPABASE_PROJECT_URL = `https://${SUPABASE_PROJECT_REF}.supabase.co`

function isProjectUrl(value: string | undefined) {
  if (!value) return false
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'https:' && parsed.hostname.endsWith('.supabase.co')
  } catch {
    return false
  }
}

function firstDefined(candidates: Array<string | undefined>) {
  return candidates.find((value) => Boolean(value?.trim()))?.trim()
}

export function getSupabaseProjectUrl() {
  const configuredUrl = [
    process.env.NEXT_PUBLIC_NEXT_PUBLIC_SUPABASE_URL_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_URL_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_URL,
  ].find(isProjectUrl)

  return configuredUrl || SUPABASE_PROJECT_URL
}

export function getSupabasePublishableKey() {
  return firstDefined([
    process.env.NEXT_PUBLIC_NEXT_PUBLIC_SUPABASE_URL_SUPABASE_PUBLISHABLE_KEY,
    process.env.NEXT_PUBLIC_SUPABASE_URL_SUPABASE_PUBLISHABLE_KEY,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    process.env.SUPABASE_PUBLISHABLE_KEY,
    process.env.SUPABASE_ANON_KEY,
    process.env.NEXT_PUBLIC_SUPABASE_URL_SUPABASE_ANON_KEY,
  ])
}

export function getSupabaseServerKey() {
  return firstDefined([
    getSupabasePublishableKey(),
    process.env.SUPABASE_SECRET_KEY,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    process.env.NEXT_PUBLIC_SUPABASE_URL_SUPABASE_SECRET_KEY,
  ])
}

export function getSupabaseServiceRoleKey() {
  return firstDefined([
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    process.env.SUPABASE_SECRET_KEY,
  ])
}
