import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * The repo resolves `braces` to a vendored copy with a nesting-depth guard
 * (GHSA-vfj7-8cjw-p6xm / CVE-2026-93687 has no upstream fix; see
 * vendor/braces-patched/README.md). These specs pin that contract so an
 * accidental re-resolve to the unpatched upstream package fails CI.
 */

type BracesFn = (input: string, options?: Record<string, unknown>) => string[]
type ParseFn = (input: string, options?: Record<string, unknown>) => void

const require = createRequire(import.meta.url)
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- vendored CommonJS module (any-typed casts below)
const braces = require('braces') as BracesFn
const parse = require('braces/lib/parse.js') as ParseFn

const vendorDir = dirname(fileURLToPath(import.meta.url))
const patchedSource = readFileSync(join(vendorDir, 'lib', 'parse.js'), 'utf8')

const nested = (depth: number) => `{a`.repeat(depth) + `x` + `}`.repeat(depth)

describe('vendored braces (CVE-2026-93687 depth guard)', () => {
  it('node_modules/braces resolves to the vendored 3.0.4 copy, not the vulnerable upstream range', () => {
    const pkg = require('braces/package.json') as { name: string; version: string }
    expect(pkg.name).toBe('braces')
    expect(pkg.version, 'vendor/braces-patched must keep a version above the advisory cap (<= 3.0.3)').toBe('3.0.4')
  })

  it('the vendored parse module still carries the depth-guard patch', () => {
    expect(patchedSource).toContain('ff-patch: GHSA-vfj7-8cjw-p6xm')
    expect(patchedSource).toContain('MAX_BRACE_DEPTH')
  })

  it('exposes the parse entrypoint with guard behavior', () => {
    expect(typeof parse).toBe('function')
  })

  it('expands ordinary patterns exactly like upstream', () => {
    expect(braces('a/{b,c}/{d,e}.{js,ts}', { expand: true })).toEqual([
      'a/b/d.js', 'a/b/d.ts', 'a/b/e.js', 'a/b/e.ts',
      'a/c/d.js', 'a/c/d.ts', 'a/c/e.js', 'a/c/e.ts',
    ])
    expect(braces('{a,b}', { expand: true })).toEqual(['a', 'b'])
  })

  it('parses nesting just under the cap without throwing', () => {
    expect(depthOf(nested(99))).toBe(99)
    expect(() => parse(nested(99))).not.toThrow()
  })

  it('rejects nesting above the cap with a catchable SyntaxError instead of crashing on the stack', () => {
    expect(depthOf(nested(101))).toBe(101)
    let error: unknown
    try {
      parse(nested(101))
    } catch (caught) {
      error = caught
    }
    expect(error).toBeInstanceOf(SyntaxError)
    expect((error as Error).message).toContain('nesting depth (101), exceeds max depth (100)')
  })

  it('guards the default compile path and the expand path', () => {
    expect(() => braces(nested(400), { expand: true })).toThrow(SyntaxError)
    expect(() => braces(nested(400))).toThrow(SyntaxError)
  })

  it('rejects absurd nesting even when a caller widens maxLength (depth is the separate axis)', () => {
    // An explicitly raised character budget would otherwise let the recursive
    // walkers run far past the stack; the depth cap must hold regardless.
    expect(() => parse(nested(101), { maxLength: 10_000 })).toThrow(SyntaxError)
  })
})

/** Deepest `{` nesting level in a balanced double-nested pattern, for sanity assertions. */
function depthOf(pattern: string): number {
  let depth = 0
  let max = 0
  for (const char of pattern) {
    if (char === '{') max = Math.max(max, ++depth)
    if (char === '}') depth--
  }
  return max
}
