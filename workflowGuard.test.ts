import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('workflow guard', () => {
  it('does not include an advanced CodeQL workflow', () => {
    expect(existsSync(join(process.cwd(), '.github/workflows/codeql.yml'))).toBe(false);
  });
});
