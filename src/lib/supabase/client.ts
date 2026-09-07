import { createBrowserClient } from '@supabase/ssr'

export function hasSupabasePublicConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim(),
  )
}

export function createClient() {
  if (!hasSupabasePublicConfig()) return null

  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  )
}

export type BrowserSupabaseClient = NonNullable<ReturnType<typeof createClient>>
