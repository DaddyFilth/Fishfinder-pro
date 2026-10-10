import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { loadProjectEnv, parseEnvNames, shellEscape } from './inject-env.mjs'

const originalEnv = { ...process.env }
let dir

const writeEnv = (name, contents) => {
  const path = join(dir, name)
  writeFileSync(path, contents)
  return path
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'inject-env-'))
  for (const key of Object.keys(process.env)) {
    if (
      key === 'NODE_ENV'
      || key.startsWith('NEXT_PUBLIC_')
      || key.startsWith('SUPABASE_')
      || key.startsWith('GROQ_')
      || key.startsWith('LOCAL_')
      || key.startsWith('MANAGED_')
    ) {
      delete process.env[key]
    }
  }
})

afterEach(() => {
  for (const [key, value] of Object.entries(originalEnv)) {
    process.env[key] = value
  }
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) delete process.env[key]
  }
  rmSync(dir, { recursive: true, force: true })
})

describe('parseEnvNames', () => {
  it('ignores comments and accepts export prefix / spaces', () => {
    expect(parseEnvNames([
      'FOO=bar',
      '  BAZ = 1',
      'export QUX=2',
      '# COMMENTED=1',
      '#NO_SPACE=1',
      '1INVALID=1',
    ].join('\n'))).toEqual(['FOO', 'BAZ', 'QUX'])
  })
})

describe('shellEscape', () => {
  it('single-quotes values and embeds single quotes safely', () => {
    expect(shellEscape('simple')).toBe("'simple'")
    expect(shellEscape("it's")).toBe("'it'\\''s'")
    expect(shellEscape('a$b`c')).toBe("'a$b`c'")
  })
})

describe('loadProjectEnv', () => {
  it('loads local env files relative to projectRoot even when cwd differs', () => {
    writeEnv('.env', 'LOCAL_ONLY=from-dot-env\n')
    const { exportable } = loadProjectEnv({ projectRoot: dir, managedEnvFile: join(dir, 'missing-managed') })
    expect(process.env.LOCAL_ONLY).toBe('from-dot-env')
    expect(exportable).toContain('LOCAL_ONLY')
  })

  it('does not overwrite values already present in the shell environment', () => {
    process.env.LOCAL_ONLY = 'shell-wins'
    writeEnv('.env', 'LOCAL_ONLY=from-file\n')
    loadProjectEnv({ projectRoot: dir, managedEnvFile: join(dir, 'missing-managed') })
    expect(process.env.LOCAL_ONLY).toBe('shell-wins')
  })

  it('tracks names from the managed env file even when absent locally', () => {
    writeEnv('managed.env', 'MANAGED_ONLY=hello\n')
    const { exportable } = loadProjectEnv({
      projectRoot: dir,
      managedEnvFile: join(dir, 'managed.env'),
    })
    expect(process.env.MANAGED_ONLY).toBe('hello')
    expect(exportable).toContain('MANAGED_ONLY')
  })

  it('normalizes double-prefixed NEXT_PUBLIC Supabase aliases', () => {
    writeEnv(
      'managed.env',
      'NEXT_PUBLIC_NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co\n',
    )
    const { exportable } = loadProjectEnv({
      projectRoot: dir,
      managedEnvFile: join(dir, 'managed.env'),
    })
    expect(process.env.NEXT_PUBLIC_SUPABASE_URL).toBe('https://example.supabase.co')
    expect(exportable).toContain('NEXT_PUBLIC_SUPABASE_URL')
  })

  it('loads production env files when NODE_ENV is production', () => {
    writeEnv('.env.production.local', 'PROD_ONLY=prod\n')
    writeEnv('.env.development.local', 'DEV_ONLY=dev\n')
    const { nodeEnv, exportable } = loadProjectEnv({
      projectRoot: dir,
      managedEnvFile: join(dir, 'missing-managed'),
      nodeEnv: 'production',
    })
    expect(nodeEnv).toBe('production')
    expect(process.env.PROD_ONLY).toBe('prod')
    expect(process.env.DEV_ONLY).toBeUndefined()
    expect(exportable).toContain('PROD_ONLY')
  })

  it('skips empty values in exportable names', () => {
    writeEnv('.env', 'EMPTY_VALUE=\n')
    const { exportable } = loadProjectEnv({
      projectRoot: dir,
      managedEnvFile: join(dir, 'missing-managed'),
    })
    expect(exportable).not.toContain('EMPTY_VALUE')
  })
})
