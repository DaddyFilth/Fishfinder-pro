import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('Copilot context guard', () => {
  it('keeps bulky non-source paths out of Copilot context', () => {
    const copilotIgnore = readFileSync(resolve(process.cwd(), '.copilotignore'), 'utf8')

    expect(copilotIgnore).toContain('.devcontainer/')
    expect(copilotIgnore).toContain('android/')
    expect(copilotIgnore).toContain('assets/')
    expect(copilotIgnore).toContain('docs/')
    expect(copilotIgnore).toContain('public/fish/')
    expect(copilotIgnore).toContain('public/species/')
    expect(copilotIgnore).toContain('ANDROID_SDK_CONFIG.md')
    expect(copilotIgnore).toContain('DEPLOYMENT.md')
    expect(copilotIgnore).toContain('DEVELOPMENT_CHECKLIST.md')
    expect(copilotIgnore).toContain('PROJECT_SETUP.md')
    expect(copilotIgnore).toContain('SECURITY.md')
    expect(copilotIgnore).toContain('VERCEL_DEPLOYMENT_CHECKLIST.md')
    expect(copilotIgnore).toContain('VERCEL_ENV_SETUP.md')
    expect(copilotIgnore).toContain('VULNERABILITY_ANALYSIS.md')
  })
})
