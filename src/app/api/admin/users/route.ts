import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole } from '@/lib/auth/server'
import { APP_ROLES } from '@/lib/auth/roles'

const RoleUpdateSchema = z.object({
  user_id: z.string().uuid(),
  role: z.enum(APP_ROLES),
}).strict()

export async function GET() {
  const context = await requireRole('admin')
  if (!context) return NextResponse.json({ error: 'Administrator access required.' }, { status: 403 })

  const { data, error } = await context.supabase
    .from('profiles')
    .select('id, username, full_name, avatar_url, role, created_at')
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ users: data ?? [] })
}

export async function PATCH(request: Request) {
  const context = await requireRole('admin')
  if (!context) return NextResponse.json({ error: 'Administrator access required.' }, { status: 403 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const parsed = RoleUpdateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'A valid user ID and role are required.' }, { status: 400 })

  if (parsed.data.user_id === context.user.id && parsed.data.role !== 'admin') {
    const { count, error: countError } = await context.supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'admin')
    if (countError) return NextResponse.json({ error: countError.message }, { status: 500 })
    if ((count ?? 0) <= 1) return NextResponse.json({ error: 'The final administrator cannot be demoted.' }, { status: 400 })
  }

  const { data, error } = await context.supabase
    .from('profiles')
    .update({ role: parsed.data.role })
    .eq('id', parsed.data.user_id)
    .select('id, username, full_name, avatar_url, role, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: error.code === 'PGRST116' ? 404 : 500 })
  return NextResponse.json({ user: data })
}
