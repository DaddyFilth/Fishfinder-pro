import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

const workflows = [
  '.github/workflows/android-aab-release.yml',
  '.github/workflows/run-supabase-migrations.yml',
  '.github/workflows/android-apk.yml',
];

describe.each(workflows)('%s workflow_dispatch', (workflowPath) => {
  it('does not define user inputs', () => {
    const workflow = read(workflowPath);
    const dispatch = workflow.match(/^\s{2}workflow_dispatch:\s*\n((?:^\s{4,}.*\n)*)/m);

    expect(dispatch).not.toBeNull();
    expect(dispatch?.[1]).not.toMatch(/^\s{4}inputs:/m);
  });
});
