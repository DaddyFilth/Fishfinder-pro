import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const workflows = [
  '.github/workflows/android-apk.yml',
  '.github/workflows/codacy.yml',
]

describe.each(workflows)('%s', (workflowPath) => {
  it('requests platform-tools from the Android setup action', () => {
    const workflow = readFileSync(resolve(process.cwd(), workflowPath), 'utf8')

    expect(workflow).toMatch(
      /- name: Set up Android SDK\n\s+uses: android-actions\/setup-android@v3\n\s+with:\n\s+packages: platform-tools/,
    )
  })
})

describe('.github/workflows/codacy.yml', () => {
  it('skips cleanly when the Codacy token is missing and does not request SARIF output', () => {
    const workflow = readFileSync(resolve(process.cwd(), '.github/workflows/codacy.yml'), 'utf8')

    expect(workflow).toContain("CODACY_PROJECT_TOKEN: ${{ secrets.CODACY_PROJECT_TOKEN }}")
    expect(workflow).toContain("if: env.CODACY_PROJECT_TOKEN == ''")
    expect(workflow).toContain('Skipping Codacy scan because CODACY_PROJECT_TOKEN is not configured.')
    expect(workflow).not.toContain('format: sarif')
    expect(workflow).not.toContain('gh-code-scanning-compat: true')
    expect(workflow).not.toContain('sarif_file: results.sarif')
  })
})
