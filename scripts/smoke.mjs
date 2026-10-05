import { createServer } from 'node:net'
import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'

const nextRunner = fileURLToPath(new URL('./run-next.mjs', import.meta.url))

async function getAvailablePort() {
  const server = createServer()
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Could not allocate a local port.')
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  return address.port
}

async function smoke() {
  const port = await getAvailablePort()
  const server = spawn(
    process.execPath,
    [nextRunner, 'start', '--hostname', '127.0.0.1', '--port', String(port)],
    { stdio: 'inherit', env: { ...process.env, PORT: String(port) } },
  )
  const exited = new Promise((resolve) => {
    server.once('exit', (code, signal) => resolve({ code, signal }))
  })
  const baseUrl = `http://127.0.0.1:${port}`
  const deadline = Date.now() + 30_000

  try {
    while (Date.now() < deadline) {
      if (server.exitCode !== null) throw new Error('The production server exited before becoming ready.')

      try {
        const health = await fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(2_000) })
        const payload = await health.json()
        if (!health.ok || payload.status !== 'ok') {
          throw new Error(`Health check failed: HTTP ${health.status}.`)
        }

        const home = await fetch(baseUrl, { signal: AbortSignal.timeout(5_000) })
        if (!home.ok) throw new Error(`Home page returned HTTP ${home.status}.`)
        console.log('Production smoke check passed: / and /api/health responded.')
        return
      } catch (error) {
        if (error instanceof Error && error.message.startsWith('Health check failed')) throw error
        if (error instanceof Error && error.message.startsWith('Home page returned')) throw error
        await delay(500)
      }
    }

    throw new Error('The production server did not become ready within 30 seconds.')
  } finally {
    if (server.exitCode === null) {
      server.kill('SIGTERM')
      const result = await Promise.race([exited, delay(5_000).then(() => null)])
      if (result === null) server.kill('SIGKILL')
    }
  }
}

smoke().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
