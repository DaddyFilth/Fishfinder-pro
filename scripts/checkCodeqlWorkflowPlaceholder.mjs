import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const allowedTopLevelKeys = new Set(['name', 'on']);
const yamlKeyPattern = /^(["']?)([A-Za-z0-9_-]+)\1:(?:\s*(.*))?$/;

function normalizeTopLevelKey(key) {
  return key === 'true' ? 'on' : key;
}

function stripInlineComment(value) {
  return value.replace(/\s+#.*$/, '').trim();
}

function normalizeScalar(value) {
  const trimmed = stripInlineComment(value);
  const quotedMatch = trimmed.match(/^(["'])(.*)\1$/);
  return quotedMatch ? quotedMatch[2] : trimmed;
}

export function inspectWorkflow(source) {
  const topLevelKeys = new Set();
  const triggerNames = new Set();
  let inOnBlock = false;
  let onIndent = -1;
  let onChildIndent = null;

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
      const topLevelMatch = line.match(yamlKeyPattern);

      if (!topLevelMatch) {
        continue;
      }

      const normalizedKey = normalizeTopLevelKey(topLevelMatch[2]);
      const value = stripInlineComment(topLevelMatch[3] ?? '');
      topLevelKeys.add(normalizedKey);

      if (normalizedKey !== 'on') {
        continue;
      }

      if (value.startsWith('[') && value.endsWith(']')) {
        for (const event of value.slice(1, -1).split(',')) {
          const normalized = normalizeScalar(event);
          if (normalized) {
            triggerNames.add(normalized);
          }
        }
        continue;
      }

      if (value) {
        triggerNames.add(normalizeScalar(value));
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

    const triggerMatch = line.match(/^(\s*)(["']?)([A-Za-z0-9_-]+)\2:(?:\s*(.+))?$/);
    if (triggerMatch) {
      triggerNames.add(normalizeScalar(triggerMatch[3]));
    }
  }

  return {
    topLevelKeys: [...topLevelKeys],
    triggerNames: [...triggerNames],
  };
}

export function getWorkflowGuardViolations(source) {
  const workflow = inspectWorkflow(source);
  const automaticTriggers = workflow.triggerNames.filter((name) => name !== 'workflow_dispatch');
  const extraKeys = workflow.topLevelKeys.filter((name) => !allowedTopLevelKeys.has(name));
  const reasons = [];

  if (automaticTriggers.length > 0) {
    reasons.push(`automatic triggers: ${automaticTriggers.join(', ')}`);
  }

  if (workflow.triggerNames.length !== 1 || workflow.triggerNames[0] !== 'workflow_dispatch') {
    reasons.push('trigger set is not manual-only workflow_dispatch');
  }

  if (extraKeys.length > 0) {
    reasons.push(`advanced configuration keys: ${extraKeys.join(', ')}`);
  }

  return reasons;
}

export function inspectWorkflowFile(workflowPath) {
  const resolvedPath = resolve(workflowPath);

  if (!existsSync(resolvedPath)) {
    return { exists: false, reasons: [] };
  }

  return {
    exists: true,
    reasons: getWorkflowGuardViolations(readFileSync(resolvedPath, 'utf8')),
  };
}

const isDirectExecution = process.argv[1] === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  const workflowPath = process.argv[2] ?? '.github/workflows/codeql.yml';
  const result = inspectWorkflowFile(workflowPath);

  if (result.reasons.length > 0) {
    console.error(
      'Forbidden CodeQL workflow configuration in .github/workflows/codeql.yml (' +
        `${result.reasons.join('; ')}). Only a manual workflow_dispatch placeholder is allowed.`,
    );
    process.exit(1);
  }
}
