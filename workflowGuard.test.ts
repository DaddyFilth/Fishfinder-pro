import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import {
  getWorkflowGuardViolations,
  inspectWorkflow,
} from './scripts/checkCodeqlWorkflowPlaceholder.mjs';

describe('workflow guard', () => {
  it('accepts a manual-only placeholder workflow', () => {
    const workflow = inspectWorkflow('name: CodeQL\non:\n  workflow_dispatch:\n');

    expect(workflow.triggerNames).toEqual(['workflow_dispatch']);
    expect(workflow.topLevelKeys).toEqual(['name', 'on']);
  });

  it('identifies automatic triggers and advanced configuration keys', () => {
    const workflow = inspectWorkflow(
      'name: CodeQL\non:\n  workflow_dispatch:\n  push:\njobs:\n  analyze:\n    runs-on: ubuntu-latest\n',
    );

    const automaticTriggers = workflow.triggerNames.filter((name) => name !== 'workflow_dispatch');
    const extraKeys = workflow.topLevelKeys.filter((name) => !['name', 'on'].includes(name));

    expect(automaticTriggers).toEqual(['push']);
    expect(extraKeys).toEqual(['jobs']);
  });

  it('rejects invalid committed workflow shapes', () => {
    const reasons = getWorkflowGuardViolations(
      'name: CodeQL\n"on": [workflow_dispatch, push] # placeholder\njobs:\n  analyze:\n    runs-on: ubuntu-latest\n',
    );

    expect(reasons).toContain('automatic triggers: push');
    expect(reasons).toContain('advanced configuration keys: jobs');
  });

  it('treats true as an alias for the on key', () => {
    const workflow = inspectWorkflow('name: CodeQL\ntrue:\n  workflow_dispatch:\n');

    expect(workflow.triggerNames).toEqual(['workflow_dispatch']);
    expect(workflow.topLevelKeys).toEqual(['name', 'on']);
  });

  it('accepts quoted on keys and inline comments', () => {
    const workflow = inspectWorkflow(
      'name: CodeQL\n"on": [workflow_dispatch] # placeholder\n',
    );

    expect(workflow.triggerNames).toEqual(['workflow_dispatch']);
    expect(workflow.topLevelKeys).toEqual(['name', 'on']);
  });

  it('accepts manual-only inline on mappings', () => {
    const workflow = inspectWorkflow('name: CodeQL\non: { workflow_dispatch: {} }\n');

    expect(workflow.triggerNames).toEqual(['workflow_dispatch']);
    expect(workflow.topLevelKeys).toEqual(['name', 'on']);
  });

  it('enforces the guard when invoked through a relative script path', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'workflow-guard-'));
    const workflowPath = join(tempDir, 'codeql.yml');

    writeFileSync(workflowPath, 'name: CodeQL\non: { workflow_dispatch: {}, push: {} }\n');

    const result = spawnSync('node', ['scripts/checkCodeqlWorkflowPlaceholder.mjs', workflowPath], {
      cwd: process.cwd(),
      encoding: 'utf8',
    });

    rmSync(tempDir, { recursive: true, force: true });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Forbidden CodeQL workflow configuration');
  });

  it('allows no CodeQL workflow or only a manual placeholder', () => {
    const workflowPath = join(process.cwd(), '.github/workflows/codeql.yml');

    if (!existsSync(workflowPath)) {
      expect(true).toBe(true);
      return;
    }

    expect(getWorkflowGuardViolations(readFileSync(workflowPath, 'utf8'))).toEqual([]);
  });
});
