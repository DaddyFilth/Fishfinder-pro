import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const layoutSource = readFileSync(resolve(process.cwd(), 'src/app/layout.tsx'), 'utf8')

describe('root layout', () => {
  it('mounts the service worker registration for every route', () => {
    // `public/sw.js` powers the offline app shell and the Settings notification
    // test, but it is only active once a client registers it. Nothing mounted
    // the registration component, so the worker never installed.
    expect(layoutSource).toContain(
      "import ServiceWorkerRegistration from \"@/components/offline/ServiceWorkerRegistration\";",
    )
    expect(layoutSource).toMatch(/<ServiceWorkerRegistration\s*\/>/)
  })

  it('renders the registration inside the document body alongside children', () => {
    const body = layoutSource.slice(layoutSource.indexOf('<body'))

    expect(body).toContain('<ServiceWorkerRegistration />')
    expect(body.indexOf('<ServiceWorkerRegistration />')).toBeLessThan(body.indexOf('{children}'))
  })
})