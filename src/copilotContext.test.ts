import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('Copilot context guard', () => {
  it('keeps bulky non-source paths out of Copilot context', () => {
    const copilotIgnore = readFileSync(resolve(process.cwd(), '.copilotignore'), 'utf8')

    expect(copilotIgnore).toContain('android/')
    expect(copilotIgnore).toContain('assets/')
    expect(copilotIgnore).toContain('docs/')
    expect(copilotIgnore).toContain('public/fish/')
    expect(copilotIgnore).toContain('public/species/')
  })
})
