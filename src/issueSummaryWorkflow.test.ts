import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const workflow = readFileSync(resolve(process.cwd(), '.github/workflows/summary.yml'), 'utf8')

describe('issue summary workflow', () => {
  it('does not fail when optional AI inference is unavailable', () => {
    expect(workflow).toMatch(
      /- name: Run AI inference\n\s+id: inference\n\s+uses: actions\/ai-inference@v1\n\s+continue-on-error: true/,
    )
  })

  it('comments only after a successful, non-empty inference response', () => {
    expect(workflow).toContain(
      "if: ${{ steps.inference.outcome == 'success' && steps.inference.outputs.response != '' }}",
    )
  })
})
