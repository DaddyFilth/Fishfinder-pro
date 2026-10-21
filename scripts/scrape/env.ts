import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ENV_FILES = ['.env.development.local', '.env.local', '.env'];
const REQUIRED = [
  ['SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL'],
  ['SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY'],
] as const;

const isMissing = () => REQUIRED.some((names) => !names.some((n) => process.env[n]?.trim()));

/**
 * Fill unset variables without overriding the real environment: first from
 * local env files, then (if still missing) from Vercel via `vercel env pull`
 * into a temporary file that is deleted immediately. Values are never printed.
 */
export function loadLocalEnv(): void {
  for (const file of ENV_FILES) {
    if (existsSync(file)) process.loadEnvFile(file);
  }
  if (!isMissing()) return;

  const dir = mkdtempSync(join(tmpdir(), 'vercel-env-'));
  const target = join(dir, '.env');
  try {
    const args = ['--yes', 'vercel', 'env', 'pull', target, '--yes', '--environment=production'];
    if (process.env.VERCEL_TOKEN) args.push('--token', process.env.VERCEL_TOKEN);
    const pull = spawnSync('npx', args, { stdio: 'ignore' });
    if (pull.status === 0 && existsSync(target)) process.loadEnvFile(target);
    else console.warn('Could not pull env from Vercel (set VERCEL_TOKEN or run `npx vercel link`).');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
