import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = (
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_NEXT_PUBLIC_SUPABASE_URL_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL_SUPABASE_URL
)?.trim()

const supabaseKey = (
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_NEXT_PUBLIC_SUPABASE_URL_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_URL_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_URL_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY
)?.trim()

export function hasSupabasePublicConfig() {
  return Boolean(supabaseUrl && supabaseKey)
}

export function createClient() {
  if (!hasSupabasePublicConfig()) return null
  return createBrowserClient(supabaseUrl!, supabaseKey!)
}
