import type { ScrapeRecord } from './lib';

const BATCH = 200;
const WORKER_URL_ENVS = ['CLOUDFLARE_WORKER_URL', 'WORKER_URL', 'SPOTS_WORKER_URL'] as const;
const WORKER_TOKEN_ENVS = ['CLOUDFLARE_WORKER_TOKEN', 'INGEST_TOKEN', 'SPOTS_WORKER_TOKEN'] as const;

function resolveEnv(names: readonly string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name];
    if (value && value.trim()) return value.trim();
  }
  return undefined;
}

export async function pushToWorker(records: ScrapeRecord[]): Promise<void> {
  const rawUrl = resolveEnv(WORKER_URL_ENVS);
  const token = resolveEnv(WORKER_TOKEN_ENVS);

  if (!rawUrl || !token) {
    console.warn(
      'Cloudflare worker URL or token is not configured (expected one of %s / %s) — skipping push.',
      WORKER_URL_ENVS.join(', '),
      WORKER_TOKEN_ENVS.join(', '),
    );
    return;
  }

  let workerUrl: string;
  try {
    const parsed = new URL(rawUrl);
    workerUrl = parsed.toString().replace(/\/+$/, '');
  } catch {
    console.warn('Invalid Cloudflare worker URL (%s) - skipping push.', rawUrl);
    return;
  }

  const endpoint = `${workerUrl}/ingest`;
  let total = 0;

  for (let i = 0; i < records.length; i += BATCH) {
    const batch = records.slice(i, i + BATCH);
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ records: batch }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '(unreadable)');
      throw new Error(`ingest failed ${res.status}: ${body.slice(0, 500)}`);
    }

    const data = (await res.json()) as { upserted?: number };
    total += data.upserted ?? batch.length;
  }

  console.log(`pushed ${total} records -> ${endpoint}`);
}
