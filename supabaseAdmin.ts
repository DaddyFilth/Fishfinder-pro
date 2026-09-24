import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  getSupabaseProjectUrl,
  getSupabasePublicConfig,
  getSupabaseServiceRoleKey,
} from './supabase/config';

export function getSupabaseAdmin(): SupabaseClient | null {
  const url = getSupabaseProjectUrl();
  const key = getSupabaseServiceRoleKey();
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function getSupabaseReadClient(): SupabaseClient | null {
  const config = getSupabasePublicConfig();
  if (!config) return null;
  return createClient(config.url, config.key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
