import { createClient } from '@/lib/supabase/server'
import { normalizeRole, type AppRole } from '@/lib/auth/roles'

export type AuthContext = {
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>
  user: {
    id: string
    email?: string
    user_metadata?: Record<string, unknown>
  }
  role: AppRole
}

export async function getAuthContext(): Promise<AuthContext | null> {
  let supabase: Awaited<ReturnType<typeof createClient>>
  try {
    supabase = await createClient()
  } catch {
    // Supabase is not configured or the request context is unavailable; treat as signed out.
    return null
  }
  if (!supabase) return null

  const { data: userData, error: userError } = await supabase.auth.getUser()
  const user = userData?.user
  if (userError || !user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  return {
    supabase,
    user,
    role: normalizeRole(profile?.role),
  }
}

export function hasRole(role: AppRole, required: AppRole) {
  if (required === 'angler') return true
  if (required === 'moderator') return role === 'moderator' || role === 'admin'
  return role === 'admin'
}

export async function requireRole(required: AppRole) {
  const context = await getAuthContext()
  if (!context || !hasRole(context.role, required)) return null
  return context
}
