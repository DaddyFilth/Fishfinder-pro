import { describe, expect, it } from 'vitest'
import { envValue } from './env'

describe('envValue', () => {
  it('returns undefined for unset, empty, and whitespace-only values', () => {
    expect(envValue(undefined)).toBeUndefined()
    expect(envValue('')).toBeUndefined()
    expect(envValue('   ')).toBeUndefined()
    expect(envValue('""')).toBeUndefined()
  })

  it('trims surrounding whitespace', () => {
    expect(envValue('  secret  ')).toBe('secret')
  })

  it('strips matching quotes', () => {
    expect(envValue('"secret"')).toBe('secret')
    expect(envValue("'secret'")).toBe('secret')
  })

  it('strips dangling quotes so pasted values still work', () => {
    expect(envValue('secret"')).toBe('secret')
    expect(envValue('"secret')).toBe('secret')
    expect(envValue('"secret\'')).toBe('secret')
  })
})
