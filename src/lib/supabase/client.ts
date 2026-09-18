import { createBrowserClient } from '@supabase/ssr'
import { getSupabaseProjectUrl, getSupabasePublishableKey } from './config'

const supabaseUrl = getSupabaseProjectUrl()
const supabaseKey = getSupabasePublishableKey()

export function hasSupabasePublicConfig() {
  return Boolean(supabaseUrl && supabaseKey)
}

export function createClient() {
  if (!hasSupabasePublicConfig()) return null
  return createBrowserClient(supabaseUrl!, supabaseKey!)
}
