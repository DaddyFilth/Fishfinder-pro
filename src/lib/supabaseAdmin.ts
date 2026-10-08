import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseProjectUrl, getSupabaseServiceRoleKey } from './supabase/config';

/**
 * Admin client for server-side operations.
 * Uses the SERVICE_ROLE_KEY to bypass Row Level Security (RLS).
 * NEVER expose this client to the browser.
 */
export function createAdminClient(): SupabaseClient {
  const url = getSupabaseProjectUrl();
  const key = getSupabaseServiceRoleKey();

  if (!url || !key) {
    throw new Error('Supabase Admin configuration is missing (URL or SERVICE_ROLE_KEY).');
  }

  return createClient(url, key);
}

/**
 * Nullable variant for API routes that want to fail with 503 instead of throwing.
 */
export function getSupabaseAdmin(): SupabaseClient | null {
  const url = getSupabaseProjectUrl();
  const key = getSupabaseServiceRoleKey();
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
