import { createClient } from '@supabase/supabase-js';
import { getSupabaseProjectUrl, getSupabaseServiceRoleKey } from './config';

/**
 * Admin client for server-side operations.
 * Uses the SERVICE_ROLE_KEY to bypass Row Level Security (RLS).
 * NEVER expose this client to the browser.
 */
export function createAdminClient() {
  const url = getSupabaseProjectUrl();
  const key = getSupabaseServiceRoleKey();

  if (!url || !key) {
    throw new Error('Supabase Admin configuration is missing (URL or SERVICE_ROLE_KEY).');
  }

  return createClient(url, key);
}
