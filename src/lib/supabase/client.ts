import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_NEXT_PUBLIC_SUPABASE_URL_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL_SUPABASE_URL ||
  process.env.SUPABASE_URL
const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_NEXT_PUBLIC_SUPABASE_URL_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_URL_SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY

export function hasSupabasePublicConfig() {
  return Boolean(supabaseUrl?.trim() && supabasePublishableKey?.trim())
}

export function createClient() {
  if (!hasSupabasePublicConfig()) return null

  return createBrowserClient(supabaseUrl!.trim(), supabasePublishableKey!.trim())
}

export type BrowserSupabaseClient = NonNullable<ReturnType<typeof createClient>>
