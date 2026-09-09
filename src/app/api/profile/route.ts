import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthContext } from '@/lib/auth/server'

const ProfileUpdateSchema = z.object({
  username: z.string().trim().min(2).max(32).regex(/^[a-zA-Z0-9_]+$/, 'Use only letters, numbers, and underscores.').nullable().optional(),
  full_name: z.string().trim().max(80).nullable().optional(),
  avatar_url: z.string().trim().url().max(500).nullable().optional(),
}).strict()

export async function GET() {
  const context = await getAuthContext()
  if (!context) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

  const { data, error } = await context.supabase
    .from('profiles')
    .select('id, username, full_name, avatar_url, role, created_at')
    .eq('id', context.user.id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

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

export async function PATCH(request: Request) {
  const context = await getAuthContext()
  if (!context) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

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
    return NextResponse.json({ error: status === 409 ? 'That username is already in use.' : error.message }, { status })
  }

  if (parsed.data.full_name !== undefined) {
    await context.supabase.auth.updateUser({ data: { full_name: update.full_name } })
  }

  return NextResponse.json({ profile: data, email: context.user.email ?? null, role: context.role })
}
