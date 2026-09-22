import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const CONFLICT_MARKER = /^(?:<{7}|={7}|>{7})(?:\s|$)/;

const SCANNED_DIRECTORIES = ['src', 'scripts', '.github', 'db', 'supabase'];
const SKIPPED_DIRECTORIES = new Set([
  'node_modules',
  '.git',
  '.next',
  'android',
  'assets',
  'public',
  'coverage',
]);
const SOURCE_EXTENSIONS = [
  '.ts',
  '.tsx',
  '.mts',
  '.cts',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.yml',
  '.yaml',
  '.sql',
  '.css',
];

export function findConflictMarkers(content: string): number[] {
  return content
    .split('\n')
    .reduce<number[]>((lines, line, index) => {
      if (CONFLICT_MARKER.test(line)) lines.push(index + 1);
      return lines;
    }, []);
}

function isScannableFile(name: string): boolean {
  return SOURCE_EXTENSIONS.some((extension) => name.endsWith(extension));
}

function collectFiles(directory: string): string[] {
  const found: string[] = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name.startsWith('.') && entry.name !== '.github') continue;
    if (SKIPPED_DIRECTORIES.has(entry.name)) continue;

    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) {
      found.push(...collectFiles(absolute));
    } else if (entry.isFile() && isScannableFile(entry.name)) {
      found.push(absolute);
    }
  }

  return found;
}

describe('merge conflict guard', () => {
  it('detects git conflict markers in file content', () => {
    const conflicted = [
      'export const value = 1;',
      '<<<<<<< HEAD',
      'export const value = 2;',
      '=======',
      'export const value = 3;',
      '>>>>>>> 0123456789abcdef0123456789abcdef01234567',
      '',
    ].join('\n');

    expect(findConflictMarkers(conflicted)).toEqual([2, 4, 6]);
  });

  it('ignores decorative lines that are not conflict markers', () => {
    const clean = [
      '// =======',
      'const marker = "<<<<<<<";',
      'title',
      '=====',
      '',
    ].join('\n');

    expect(findConflictMarkers(clean)).toEqual([]);
  });

  it('keeps committed source files free of conflict markers', () => {
    const root = process.cwd();
    const offenders = SCANNED_DIRECTORIES.flatMap((directory) => collectFiles(resolve(root, directory))).flatMap(
      (file) =>
        findConflictMarkers(readFileSync(file, 'utf8')).map(
          (line) => `${file.replace(`${root}/`, '')}:${line}`,
        ),
    );

    expect(offenders).toEqual([]);
  });
});
