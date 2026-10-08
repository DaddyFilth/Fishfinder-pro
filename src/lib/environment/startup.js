function firstDefined(environment, names) {
  return names.map((name) => environment[name]?.trim()).find(Boolean)
}

export function validateRuntimeEnvironment(environment = process.env) {
  const missing = []
  const supabaseUrl = firstDefined(environment, ['NEXT_PUBLIC_SUPABASE_URL'])
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
    missing.push('NEXT_PUBLIC_SUPABASE_URL (an http(s) URL)')
  }

  if (!firstDefined(environment, [
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  ])) {
    missing.push('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)')
  }

  if (missing.length > 0) {
    throw new Error(`Fishfinder Pro cannot start. Configure: ${missing.join('; ')}.`)
  }
}
