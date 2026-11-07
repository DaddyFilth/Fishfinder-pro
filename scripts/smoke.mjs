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

async function assertDirectOk(baseUrl, path) {
  const res = await fetch(`${baseUrl}${path}`, {
    redirect: 'manual',
    signal: AbortSignal.timeout(8_000),
  })
  if (res.status !== 200) {
    const location = res.headers.get('location')
    throw new Error(
      `Expected HTTP 200 for ${path} without redirects, received HTTP ${res.status}${location ? ` -> ${location}` : ''}.`,
    )
  }
  return res
}

function extractSitemapPaths(xml) {
  const matches = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
  return matches.map((match) => {
    const url = new URL(match[1])
    return `${url.pathname}${url.search}`
  })
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
        const health = await fetch(`${baseUrl}/api/health`, {
          redirect: 'manual',
          signal: AbortSignal.timeout(2_000),
        })
        const payload = await health.json()
        if (!health.ok || payload.status !== 'ok') {
          throw new Error(`Health check failed: HTTP ${health.status}.`)
        }

        const sitemapRes = await assertDirectOk(baseUrl, '/sitemap.xml')
        const sitemapXml = await sitemapRes.text()
        const sitemapPaths = extractSitemapPaths(sitemapXml)
        if (sitemapPaths.length === 0) {
          throw new Error('Expected /sitemap.xml to contain public URLs.')
        }

        for (const path of sitemapPaths) {
          await assertDirectOk(baseUrl, path)
        }

        for (const assetPath of [
          '/apple-touch-icon.png',
          '/google9b802e8e87b013ca.html',
          '/fish/blue-catfish.jpg',
          '/llms.txt',
          '/robots.txt',
        ]) {
          await assertDirectOk(baseUrl, assetPath)
        }

        const legacyRedirect = await fetch(`${baseUrl}/locations/lake-hefner`, {
          redirect: 'manual',
          signal: AbortSignal.timeout(5_000),
        })
        if (legacyRedirect.status !== 308 || !legacyRedirect.headers.get('location')?.endsWith('/fishing-spots/lake-hefner')) {
          throw new Error(
            `Expected /locations/lake-hefner to 308-redirect to /fishing-spots/lake-hefner, received HTTP ${legacyRedirect.status} -> ${legacyRedirect.headers.get('location')}.`,
          )
        }

        console.log(
          `Production smoke check passed: ${sitemapPaths.length}/${sitemapPaths.length} sitemap URLs and public assets returned HTTP 200 directly; /locations redirected with HTTP 308.`,
        )
        return
      } catch (error) {
        if (
          error instanceof Error &&
          (error.message.startsWith('Health check failed') || error.message.startsWith('Expected '))
        ) {
          throw error
        }
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
