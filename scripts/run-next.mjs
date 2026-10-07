import { existsSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { validateRuntimeEnvironment } from '../src/lib/environment/startup.js'

const [command, ...args] = process.argv.slice(2)
if (!['dev', 'start'].includes(command)) {
  throw new Error('Usage: node scripts/run-next.mjs <dev|start> [Next.js options]')
}

if (typeof process.loadEnvFile !== 'function') {
  throw new Error('Fishfinder Pro requires Node.js 22 or newer.')
}

process.env.NODE_ENV = command === 'start' ? 'production' : 'development'
// Load managed project variables first. Node's env loader does not overwrite
// existing keys, so this prevents stale local placeholders from winning.
const managedEnvFile = '/vercel/share/.env.project'
if (existsSync(managedEnvFile)) process.loadEnvFile(managedEnvFile)

const envFiles = command === 'dev'
  ? ['.env.development.local', '.env.local', '.env.development', '.env']
  : ['.env.production.local', '.env.local', '.env.production', '.env']
for (const path of envFiles) {
  if (existsSync(path)) process.loadEnvFile(path)
}

// Some Vercel project snapshots expose public variables with an extra
// NEXT_PUBLIC_ prefix. Normalize those aliases before validation and before
// handing the environment to Next.js.
for (const name of [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
]) {
  const aliasedName = `NEXT_PUBLIC_${name}`
  if (!process.env[name] && process.env[aliasedName]) {
    process.env[name] = process.env[aliasedName]
  }
}

// Production must fail fast when required services are absent. Development and
// v0 previews can still render public routes that gracefully handle an
// unavailable Supabase client, so do not turn a missing local secret into a
// gateway-level 502.
if (process.env.NODE_ENV === 'production') validateRuntimeEnvironment()

const nextBin = fileURLToPath(new URL('../node_modules/next/dist/bin/next', import.meta.url))
const next = spawn(process.execPath, [nextBin, command, ...args], {
  stdio: 'inherit',
  env: process.env,
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => next.kill(signal))
}

next.once('error', (error) => {
  console.error(error)
  process.exitCode = 1
})
next.once('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  else process.exitCode = code ?? 1
})
