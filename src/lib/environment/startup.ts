type Environment = Record<string, string | undefined>

function firstDefined(environment: Environment, names: string[]) {
  return names.map((name) => environment[name]?.trim()).find(Boolean)
}

export function validateRuntimeEnvironment(environment: Environment = process.env) {
  const missing: string[] = []
  const supabaseUrl = firstDefined(environment, [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_URL',
  ])
  let validSupabaseUrl = false

  if (supabaseUrl) {
    try {
      const url = new URL(supabaseUrl)
      validSupabaseUrl = url.protocol === 'http:' || url.protocol === 'https:'
    } catch {
      validSupabaseUrl = false
    }
  }

  if (!validSupabaseUrl) {
    missing.push('NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL with an http(s) URL)')
  }

  if (!firstDefined(environment, [
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    'NEXT_PUBLIC_NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'NEXT_PUBLIC_NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_PUBLISHABLE_KEY',
    'SUPABASE_ANON_KEY',
  ])) {
    missing.push('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)')
  }

  if (environment.NODE_ENV === 'production') {
    const redisUrl = firstDefined(environment, ['REDIS_URL'])
    let validRedisUrl = false

    if (redisUrl) {
      try {
        const url = new URL(redisUrl)
        validRedisUrl = url.protocol === 'redis:' || url.protocol === 'rediss:'
      } catch {
        validRedisUrl = false
      }
    }

    if (!validRedisUrl) missing.push('REDIS_URL (a redis:// or rediss:// URL)')
  }

  if (missing.length > 0) {
    throw new Error(`Fishfinder Pro cannot start. Configure: ${missing.join('; ')}.`)
  }
}
