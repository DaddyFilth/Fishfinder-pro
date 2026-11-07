import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthContext } from '@/lib/auth/server'
import { enforceRateLimit, isHttpUrl, isSameOrigin, readJsonBody } from '@/lib/security'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

const ProfileUpdateSchema = z.object({
  username: z.string().trim().min(2).max(32).regex(/^[a-zA-Z0-9_]+$/, 'Use only letters, numbers, and underscores.').nullable().optional(),
  full_name: z.string().trim().max(80).nullable().optional(),
  avatar_url: z.string().trim().url().max(500).refine(isHttpUrl, 'Use an HTTP or HTTPS avatar URL.').nullable().optional(),
}).strict()

const AccountDeleteSchema = z.object({
  confirm: z.literal('DELETE'),
}).strict()

const PRIVATE_PHOTO_BUCKETS = ['catch-photos', 'logbook-photos'] as const

export async function GET() {
  const context = await getAuthContext()
  if (!context) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

  const { data, error } = await context.supabase
    .from('profiles')
    .select('id, username, full_name, avatar_url, role, created_at')
    .eq('id', context.user.id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: 'Unable to load profile.' }, { status: 500 })

  return NextResponse.json({
    profile: data ?? {
      id: context.user.id,
      username: null,
      full_name: typeof context.user.user_metadata?.full_name === 'string' ? context.user.user_metadata.full_name : null,
      avatar_url: null,
      role: context.role,
      created_at: new Date().toISOString(),
    },
    email: context.user.email ?? null,
    role: context.role,
  })
}

export async function PATCH(request: NextRequest) {
  const limited = await enforceRateLimit(request, { name: 'profile-write', limit: 10, windowMs: 60_000 })
  if (limited) return limited
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Cross-site requests are not allowed.' }, { status: 403 })
  const context = await getAuthContext()
  if (!context) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

  const bodyResult = await readJsonBody(request, 32_768)
  if (!bodyResult.ok) return bodyResult.response
  const body = bodyResult.value

  const parsed = ProfileUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid profile.' }, { status: 400 })
  }

  const update = {
    id: context.user.id,
    username: parsed.data.username === undefined ? undefined : parsed.data.username || null,
    full_name: parsed.data.full_name === undefined ? undefined : parsed.data.full_name || null,
    avatar_url: parsed.data.avatar_url === undefined ? undefined : parsed.data.avatar_url || null,
  }

  const { data, error } = await context.supabase
    .from('profiles')
    .upsert(update, { onConflict: 'id' })
    .select('id, username, full_name, avatar_url, role, created_at')
    .single()

  if (error) {
    const status = error.code === '23505' ? 409 : 500
    return NextResponse.json({ error: status === 409 ? 'That username is already in use.' : 'Unable to save profile.' }, { status })
  }

  if (parsed.data.full_name !== undefined) {
    await context.supabase.auth.updateUser({ data: { full_name: update.full_name } })
  }

  return NextResponse.json({ profile: data, email: context.user.email ?? null, role: context.role })
}

export async function DELETE(request: NextRequest) {
  const limited = await enforceRateLimit(request, { name: 'profile-delete', limit: 5, windowMs: 60_000 })
  if (limited) return limited
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: 'Cross-site requests are not allowed.' }, { status: 403 })
  }

  const context = await getAuthContext()
  if (!context) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }

  const bodyResult = await readJsonBody(request, 4_096)
  if (!bodyResult.ok) return bodyResult.response

  const parsed = AccountDeleteSchema.safeParse(bodyResult.value)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Confirm permanent deletion by sending { "confirm": "DELETE" }.' },
      { status: 400 },
    )
  }

  const admin = getSupabaseAdmin()
  if (!admin) {
    return NextResponse.json(
      { error: 'Account deletion is temporarily unavailable because server administration is not configured.' },
      { status: 503 },
    )
  }

  if (context.role === 'admin') {
    const { count, error: countError } = await admin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'admin')
    if (countError) {
      return NextResponse.json({ error: 'Unable to verify administrator count.' }, { status: 500 })
    }
    if ((count ?? 0) <= 1) {
      return NextResponse.json(
        { error: 'Transfer administrator access to another user before deleting the final administrator account.' },
        { status: 400 },
      )
    }
  }

  const userId = context.user.id

  // Best-effort cleanup of private photo objects in user-scoped Storage prefixes before auth cascade.
  for (const bucket of PRIVATE_PHOTO_BUCKETS) {
    try {
      const { data: objects } = await admin.storage.from(bucket).list(userId, { limit: 1000 })
      const paths = (objects ?? [])
        .map((item) => item.name)
        .filter(Boolean)
        .map((name) => `${userId}/${name}`)
      if (paths.length > 0) {
        await admin.storage.from(bucket).remove(paths)
      }
    } catch {
      // Continue with auth deletion even if storage listing is unavailable.
    }
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(userId)
  if (deleteError) {
    return NextResponse.json({ error: 'Unable to delete account right now.' }, { status: 500 })
  }

  try {
    await admin.from('admin_audit_log').insert({
      actor_id: null,
      target_user_id: null,
      action: 'self_delete_account',
      details: { deleted_user_id: userId },
    })
  } catch {
    // Non-blocking audit insert.
  }

  await context.supabase.auth.signOut().catch(() => undefined)

  return NextResponse.json({ deleted: true })
}
