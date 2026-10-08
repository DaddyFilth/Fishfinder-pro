import { chromium, type Browser, type BrowserContext, type Page } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const OUT_DIR = join(process.cwd(), 'exports');
export const DEBUG_DIR = join(OUT_DIR, 'debug');

export type ScrapeRecord = {
  name: string;
  category: string;
  waterbody?: string;
  county?: string;
  ada: boolean;
  amenities: string[];
  notes: string;
  source_url: string;
  scraped_at: string;
};

export async function withBrowser<T>(fn: (ctx: BrowserContext) => Promise<T>): Promise<T> {
  const browser: Browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      userAgent: 'SeamCactDataBot/0.1 (one-off public-data crawl, ~1 req / 2s)',
      viewport: { width: 1366, height: 900 },
      locale: 'en-US',
    });
    return await fn(context);
  } finally {
    await browser.close();
  }
}

export async function gotoPolite(page: Page, url: string, attempts = 3): Promise<void> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
      await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
      await page.waitForTimeout(1500 + Math.random() * 1500);
      return;
    } catch (err) {
      lastErr = err;
      await page.waitForTimeout(3000 * (i + 1));
    }
  }
  throw lastErr;
}

export function csvEscape(v: string | undefined | null): string {
  if (v == null) return '';
  const s = String(v);
  const needsQuoting = /[",\n]/.test(s);
  return needsQuoting ? `"${s.replace(/"/g, '""')}"` : s;
}

const CSV_COLUMNS: (keyof ScrapeRecord)[] = [
  'name', 'category', 'waterbody', 'county', 'ada', 'amenities', 'notes', 'source_url', 'scraped_at',
];

export function writeOutputs(records: ScrapeRecord[], slug: string): { json: string; csv: string } {
  mkdirSync(OUT_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const jsonPath = join(OUT_DIR, `${slug}-${stamp}.json`);
  const csvPath = join(OUT_DIR, `${slug}-${stamp}.csv`);
  writeFileSync(jsonPath, JSON.stringify(records, null, 2));
  const header = CSV_COLUMNS.join(',');
  const rows = records.map((r) =>
    CSV_COLUMNS.map((c) => csvEscape(Array.isArray(r[c]) ? (r[c] as string[]).join('; ') : String(r[c] ?? ''))).join(','),
  );
  writeFileSync(csvPath, [header, ...rows].join('\n'));
  console.log(`wrote ${records.length} records -> ${jsonPath} / ${csvPath}`);
  return { json: jsonPath, csv: csvPath };
}

export async function debugDump(page: Page, tag: string): Promise<void> {
  mkdirSync(DEBUG_DIR, { recursive: true });
  writeFileSync(join(DEBUG_DIR, `${tag}.html`), await page.content());
  await page.screenshot({ path: join(DEBUG_DIR, `${tag}.png`), fullPage: true });
  console.log(`debug dump -> exports/debug/${tag}.html / .png`);
}
