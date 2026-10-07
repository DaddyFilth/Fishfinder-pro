import { describe, expect, it } from 'vitest'
import { metadata as devMetadata } from './dev/layout'
import { metadata as offlineMetadata } from './offline/layout'

describe('operational route robots metadata', () => {
  it.each([
    ['development', devMetadata],
    ['offline', offlineMetadata],
  ])('%s route is excluded from indexing', (_name, metadata) => {
    expect(metadata.robots).toEqual({ index: false, follow: false })
  })
})
