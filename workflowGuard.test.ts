import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function inspectWorkflow(source: string) {
  const topLevelKeys = new Set<string>();
  const triggerNames = new Set<string>();
  let inOnBlock = false;
  let onIndent = -1;
  let onChildIndent: number | null = null;

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.replace(/\t/g, '    ');
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const indent = line.match(/^ */)?.[0].length ?? 0;

    if (inOnBlock && indent <= onIndent) {
      inOnBlock = false;
      onIndent = -1;
      onChildIndent = null;
    }

    if (!inOnBlock && indent === 0) {
      const topLevelMatch = line.match(/^([A-Za-z0-9_-]+):(?:\s*(.+))?$/);

      if (!topLevelMatch) {
        continue;
      }

      const [, key, value = ''] = topLevelMatch;
      topLevelKeys.add(key);

      if (key !== 'on') {
        continue;
      }

      if (value.startsWith('[') && value.endsWith(']')) {
        for (const event of value.slice(1, -1).split(',')) {
          const normalized = event.trim();
          if (normalized) {
            triggerNames.add(normalized);
          }
        }
        continue;
      }

      if (value) {
        triggerNames.add(value.trim());
        continue;
      }

      inOnBlock = true;
      onIndent = indent;
      continue;
    }

    if (!inOnBlock) {
      continue;
    }

    if (onChildIndent === null) {
      onChildIndent = indent;
    }

    if (indent !== onChildIndent) {
      continue;
    }

    const triggerMatch = line.match(/^(\s*)([A-Za-z0-9_-]+):(?:\s*(.+))?$/);
    if (triggerMatch) {
      triggerNames.add(triggerMatch[2]);
    }
  }

  return {
    topLevelKeys: [...topLevelKeys],
    triggerNames: [...triggerNames],
  };
}

describe('workflow guard', () => {
  it('allows no CodeQL workflow or only a manual placeholder', () => {
    const workflowPath = join(process.cwd(), '.github/workflows/codeql.yml');

    if (!existsSync(workflowPath)) {
      expect(true).toBe(true);
      return;
    }

    const workflow = inspectWorkflow(readFileSync(workflowPath, 'utf8'));
    const automaticTriggers = workflow.triggerNames.filter((name) => name !== 'workflow_dispatch');
    const extraKeys = workflow.topLevelKeys.filter((name) => !['name', 'on'].includes(name));

    expect(automaticTriggers).toEqual([]);
    expect(workflow.triggerNames).toEqual(['workflow_dispatch']);
    expect(extraKeys).toEqual([]);
  });
});
