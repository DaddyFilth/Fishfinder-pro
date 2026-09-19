import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const workflowPath = resolve(process.cwd(), '.github/workflows/contrast-scan.yml')

describe('contrast scan workflow', () => {
  it('skips cleanly when required Contrast configuration is missing', () => {
    const workflow = readFileSync(workflowPath, 'utf8')

    expect(workflow).toContain('CONTRAST_ARTIFACT_PATH: ${{ vars.CONTRAST_ARTIFACT_PATH }}')
    expect(workflow).toContain(
      "if: env.CONTRAST_API_KEY == '' || env.CONTRAST_ORGANIZATION_ID == '' || env.CONTRAST_AUTH_HEADER == '' || env.CONTRAST_ARTIFACT_PATH == ''",
    )
    expect(workflow).toContain('Skipping Contrast scan because required Contrast secrets or CONTRAST_ARTIFACT_PATH are not configured.')
    expect(workflow).toContain(
      "if: env.CONTRAST_API_KEY != '' && env.CONTRAST_ORGANIZATION_ID != '' && env.CONTRAST_AUTH_HEADER != '' && env.CONTRAST_ARTIFACT_PATH != ''",
    )
    expect(workflow).not.toContain('artifact: mypath/target/myartifact.jar')
  })
})
