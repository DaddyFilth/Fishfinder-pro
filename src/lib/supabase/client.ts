import { createBrowserClient } from '@supabase/ssr'
import { getSupabaseProjectUrl, getSupabasePublishableKey } from './config'

const supabaseUrl = getSupabaseProjectUrl()
const supabaseKey = getSupabasePublishableKey()

let browserClient: ReturnType<typeof createBrowserClient> | null = null

export function hasSupabasePublicConfig() {
  return Boolean(supabaseUrl && supabaseKey)
}

export function createClient() {
  if (!hasSupabasePublicConfig()) return null
  browserClient ??= createBrowserClient(supabaseUrl!, supabaseKey!)
  return browserClient
}
