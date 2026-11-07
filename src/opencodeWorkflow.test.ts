import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('opencode GitHub Actions workflow security', () => {
  const workflow = readFileSync(resolve(process.cwd(), '.github/workflows/opencode.yml'), 'utf8')

  it('restricts comment execution to trusted repository associations and non-bot actors', () => {
    expect(workflow).toContain('github.event.comment.author_association')
    expect(workflow).toContain('OWNER')
    expect(workflow).toContain('MEMBER')
    expect(workflow).toContain('COLLABORATOR')
    expect(workflow).toContain("github.event.comment.user.type != 'Bot'")
  })

  it('does not grant OIDC id-token write permissions and disables persisted git credentials', () => {
    expect(workflow).not.toContain('id-token: write')
    expect(workflow).toContain('persist-credentials: false')
  })

  it('pins anomalyco/opencode/github to a full 40-character commit SHA instead of @latest', () => {
    expect(workflow).not.toContain('anomalyco/opencode/github@latest')
    expect(workflow).toMatch(/uses:\s+anomalyco\/opencode\/github@[0-9a-f]{40}\b/)
  })
})
