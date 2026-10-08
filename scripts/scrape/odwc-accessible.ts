import { withBrowser, gotoPolite, writeOutputs, debugDump, type ScrapeRecord } from './lib';
import { pushToWorker } from './push';

const URL = 'https://www.wildlifedepartment.com/fishing/wheretofish/access';
const DEBUG = process.argv.includes('--debug');

async function extract(page: import('playwright-core').Page): Promise<ScrapeRecord[]> {
  await page.waitForSelector('main h2, main h3, article h2, article h3, h2, h3', { timeout: 20_000 })
    .catch(() => console.warn('no headings matched - check exports/debug dump'));

  const blocks = await page.evaluate(() => {
    const root: Element =
      document.querySelector('main') ?? document.querySelector('article') ?? document.body;
    const heads = Array.from(root.querySelectorAll('h2, h3'));
    return heads.map((h) => {
      const parts: string[] = [];
      let el: Element | null = h.nextElementSibling;
      while (el && !/^H[123]$/.test(el.tagName) && parts.length < 12) {
        const t = (el.textContent ?? '').replace(/s+/g, ' ').trim();
        if (t) parts.push(t);
        el = el.nextElementSibling;
      }
      return { title: (h.textContent ?? '').replace(/s+/g, ' ').trim(), body: parts.join(' ') };
    }).filter((b) => b.title.length > 0 && b.title.length < 120);
  });

  const now = new Date().toISOString();
  const records: ScrapeRecord[] = [];
  for (const b of blocks) {
    const text = `${b.title} ${b.body}`.toLowerCase();
    const looksLikeSite =
      /(pier|dock|lake|pond|river|creek|reservoir|access|park)/.test(b.title.toLowerCase()) ||
      /(wheelchair|pier|dock|accessible)/.test(text);
    if (!looksLikeSite) continue;

    const ada = /(wheelchair|ada|disabled|accessib|mobilit)/.test(text);
    const phoneMatch = b.body.match(/(d{3})s?d{3}-d{4}/);
    const amenities: string[] = [];
    if (/pier/.test(text)) amenities.push('fishing pier');
    if (/dock/.test(text)) amenities.push('fishing dock');
    if (/platform/.test(text)) amenities.push('platform');
    if (/shore|bank/.test(text)) amenities.push('shore access');
    if (ada) amenities.push('wheelchair accessible');

    records.push({
      name: b.title,
      category: 'odwc-accessible-fishing',
      ada,
      amenities,
      notes: [b.body.slice(0, 500), phoneMatch ? `contact: ${phoneMatch[0]}` : null]
        .filter(Boolean)
        .join(' | '),
      source_url: URL,
      scraped_at: now,
    });
  }
  return records;
}

const run = withBrowser(async (ctx) => {
  const page = await ctx.newPage();
  await gotoPolite(page, URL);
  if (DEBUG) await debugDump(page, 'odwc-access');
  const records = await extract(page);
  if (records.length === 0) {
    console.warn('0 records - rerun with --debug and verify selectors against the dump.');
  }
  writeOutputs(records, 'odwc-accessible-fishing');
  if (process.argv.includes('--push')) await pushToWorker(records);
  await page.close();
});

run.catch((err) => { console.error(err); process.exit(1); });
