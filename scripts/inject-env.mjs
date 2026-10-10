#!/usr/bin/env node
// Loads project env files (same priority as run-next.mjs), normalizes public
// Supabase aliases, then either prints shell exports or runs a command with
// those variables injected. Secrets are only printed in export mode (needed
// for `eval`); command mode never prints values.
import { existsSync, readFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateRuntimeEnvironment } from '../src/lib/environment/startup.js'

export const parseEnvNames = (text) => {
  const names = []
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/)
    if (m) names.push(m[1])
  }
  return names
}

export const shellEscape = (value) => `'${value.replace(/'/g, `'\\''`)}'`

const publicAliasSources = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
]

/**
 * Loads managed + local env files into process.env (shell values win), normalizes
 * double-prefixed NEXT_PUBLIC_* Supabase aliases, and returns exportable names.
 * Mutates process.env on purpose so spawn/child processes inherit the result.
 */
export function loadProjectEnv({
  projectRoot,
  managedEnvFile = '/vercel/share/.env.project',
  nodeEnv = process.env.NODE_ENV === 'production' ? 'production' : 'development',
} = {}) {
  if (typeof process.loadEnvFile !== 'function') {
    throw new Error('Fishfinder Pro requires Node.js 20.12+ or Node.js 22+ (process.loadEnvFile).')
  }
  if (!projectRoot) {
    throw new Error('loadProjectEnv requires projectRoot')
  }

  process.env.NODE_ENV = nodeEnv

  // Prefer already-exported shell values, then managed Vercel snapshot, then
  // local env files (loadEnvFile does not overwrite existing keys).
  const fileNames = new Set()
  const loadFile = (path) => {
    if (!existsSync(path)) return
    process.loadEnvFile(path)
    for (const name of parseEnvNames(readFileSync(path, 'utf8'))) fileNames.add(name)
  }

  loadFile(managedEnvFile)
  const envFiles = nodeEnv === 'development'
    ? ['.env.development.local', '.env.local', '.env.development', '.env']
    : ['.env.production.local', '.env.local', '.env.production', '.env']
  for (const relative of envFiles) loadFile(join(projectRoot, relative))

  for (const name of publicAliasSources) {
    // Some Vercel project snapshots expose public variables with an extra
    // NEXT_PUBLIC_ prefix (NEXT_PUBLIC_NEXT_PUBLIC_SUPABASE_URL, ...).
    const aliasedName = `NEXT_PUBLIC_${name}`
    if (!process.env[name] && process.env[aliasedName]) {
      process.env[name] = process.env[aliasedName]
    }
    if (typeof process.env[name] === 'string' && process.env[name] !== '') {
      fileNames.add(name)
    }
  }

  const exportable = [...fileNames].filter((name) => {
    const value = process.env[name]
    return typeof value === 'string' && value !== ''
  }).sort()

  return { exportable, nodeEnv }
}

const isMain = process.argv[1]
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isMain) {
  const argv = process.argv.slice(2)
  const modeExport = argv[0] === '--export' || argv[0] === 'export'
  const commandIndex = argv[0] === '--' ? 1 : modeExport ? -1 : 0
  const command = commandIndex >= 0 ? argv.slice(commandIndex) : []

  if (!modeExport && command.length === 0) {
    console.error('Usage: node scripts/inject-env.mjs --export')
    console.error('       node scripts/inject-env.mjs -- <command> [args...]')
    console.error('  eval: eval "$(node scripts/inject-env.mjs --export)"')
    console.error('   npm: npm run -s env:export   # -s avoids npm banner on stdout')
    process.exit(1)
  }

  const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const { exportable, nodeEnv } = loadProjectEnv({ projectRoot })

  if (nodeEnv === 'production') {
    try {
      validateRuntimeEnvironment(process.env)
    } catch (error) {
      console.error(error instanceof Error ? error.message : error)
      process.exit(1)
    }
  }

  if (modeExport) {
    for (const name of exportable) {
      console.log(`export ${name}=${shellEscape(process.env[name])}`)
    }
    console.error(
      `# ${exportable.length} env vars loaded (NODE_ENV=${nodeEnv}). ` +
      'Source via: eval "$(node scripts/inject-env.mjs --export)"',
    )
    process.exit(0)
  }

  const [bin, ...args] = command
  if (!bin) {
    console.error('Usage: node scripts/inject-env.mjs -- <command> [args...]')
    process.exit(1)
  }

  const child = spawn(bin, args, { stdio: 'inherit', env: process.env })
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => child.kill(signal))
  }
  child.once('error', (error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  child.once('exit', (code, signal) => {
    if (signal) process.kill(process.pid, signal)
    else process.exitCode = code ?? 1
  })
}
