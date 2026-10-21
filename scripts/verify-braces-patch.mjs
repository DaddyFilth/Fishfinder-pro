// Sanity checks for the vendored, patched copy of braces (vendor/braces-patched).
// Run: node scripts/verify-braces-patch.mjs
import { createRequire } from 'node:module'

const require = createRequire(`${new URL('.', import.meta.url).href}../`)
const braces = require('./vendor/braces-patched/index.js')

let failures = 0
const check = (name, fn) => {
  try {
    fn()
    console.log(`ok - ${name}`)
  } catch (error) {
    failures++
    console.error(`FAIL - ${name}: ${error?.message ?? error}`)
  }
}

const assert = (condition, message) => {
  if (!condition) throw new Error(message)
}

// Standard behavior must be unchanged.
check('compile preserves upstream optimization for ranges', () => {
  const out = braces('{01..03}')
  assert(out.includes('(0[1-3])'), `expected upstream compile form, got ${JSON.stringify(out)}`)
})

check('expand produces cartesian output', () => {
  const out = braces('a/{b,c}/{d,e}.{js,ts}', { expand: true })
  assert(out.length === 8, `expected 8 expansions, got ${out.length}: ${JSON.stringify(out)}`)
})

// Depth guard turns the stack-exhaustion crash (uncaught RangeError that takes
// down the process) into a catchable SyntaxError.
check('deep nesting above the cap throws SyntaxError', () => {
  const deep = '{a['.repeat(4000) + '}'.repeat(0)
  const pattern = '{a'.repeat(4000) + 'x' + '}'.repeat(4000)
  assert(pattern.length >= 4000, 'sanity: pattern built')
  let thrown = null
  try { braces(pattern, { expand: true }) } catch (error) { thrown = error }
  assert(thrown && thrown.name === 'SyntaxError', `expected SyntaxError, got ${thrown?.name}: ${thrown?.message}`)
  void deep
})

check('nesting just under the cap still expands', () => {
  const pattern = '{a'.repeat(50) + 'x' + '}'.repeat(50)
  const out = braces(pattern, { expand: true })
  assert(out.length > 0, 'expected some expansion')
})

check('compile path is also depth-guarded', () => {
  const pattern = '{a'.repeat(200) + 'x' + '}'.repeat(200)
  let thrown = null
  try { braces(pattern) } catch (error) { thrown = error }
  assert(thrown && thrown.name === 'SyntaxError', `expected SyntaxError, got ${thrown?.name}: ${thrown?.message}`)
})

if (failures > 0) {
  console.error(`${failures} check(s) failed`)
  process.exit(1)
}
console.log('All braces patch checks passed.')
