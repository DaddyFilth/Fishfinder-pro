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
