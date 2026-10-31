import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const deepmerge = require('./index.js') as (
  target: Record<string, unknown>,
  source: Record<string, unknown>,
) => Record<string, unknown>

describe('vendored deepmerge GHSA-gcqx-w48m-w2h4 prototype-poisoning guard', () => {
  it('merges ordinary nested objects and arrays normally', () => {
    const merged = deepmerge(
      { a: 1, nested: { left: true }, items: [1] },
      { b: 2, nested: { right: true }, items: [2] },
    )
    expect(merged).toEqual({
      a: 1,
      b: 2,
      nested: { left: true, right: true },
      items: [1, 2],
    })
  })

  it('refuses to poison destination prototype via JSON-parsed __proto__, constructor, or prototype keys', () => {
    const maliciousSource = JSON.parse('{"__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}},"safe":1}')
    const nullProtoTarget = Object.assign(Object.create(null), JSON.parse('{"__proto__":{"fromTarget":true}}'))

    const result = deepmerge(nullProtoTarget, maliciousSource)

    expect(result.safe).toBe(1)
    expect((result as { polluted?: unknown }).polluted).toBeUndefined()
    expect((result as { fromTarget?: unknown }).fromTarget).toBeUndefined()
    expect(({} as { polluted?: unknown }).polluted).toBeUndefined()
  })
})
