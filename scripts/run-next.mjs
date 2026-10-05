import { existsSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { validateRuntimeEnvironment } from '../src/lib/environment/startup.js'

const [command, ...args] = process.argv.slice(2)
if (!['dev', 'start'].includes(command)) {
  throw new Error('Usage: node scripts/run-next.mjs <dev|start> [Next.js options]')
}

if (typeof process.loadEnvFile !== 'function') {
  throw new Error('Fishfinder Pro requires Node.js 20.12 or newer.')
}

process.env.NODE_ENV = command === 'start' ? 'production' : 'development'
const envFiles = command === 'dev'
  ? ['.env.development.local', '.env.local', '.env.development', '.env']
  : ['.env.production.local', '.env.local', '.env.production', '.env']
for (const path of envFiles) {
  if (existsSync(path)) process.loadEnvFile(path)
}

validateRuntimeEnvironment()

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
