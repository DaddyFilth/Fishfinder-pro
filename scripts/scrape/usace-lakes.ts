import { withBrowser, gotoPolite, writeOutputs, debugDump, type ScrapeRecord } from './lib';
import { pushToWorker } from './push';
import type { Page } from 'playwright';

const INDEX = 'https://www.swt.usace.army.mil/Locations/Tulsa-District-Lakes/Oklahoma/';
const DEBUG = process.argv.includes('--debug');
const limitArg = process.argv.find((a) => a.startsWith('--limit='));
const LIMIT = limitArg ? Number(limitArg.split('=')[1]) : Infinity;

async function collectLakeLinks(page: Page): Promise<{ name: string; url: string }[]> {
  await gotoPolite(page, INDEX);
  const links = await page.evaluate((base) => {
    const seen = new Set<string>();
    const out: { name: string; url: string }[] = [];
    for (const a of Array.from(document.querySelectorAll('a[href]'))) {
      const href = (a as HTMLAnchorElement).getAttribute('href') ?? '';
      const full = new URL(href, base).toString();
      const label = ((a as HTMLAnchorElement).textContent ?? '').replace(/s+/g, ' ').trim();
      if (
        full.includes('/Locations/Tulsa-District-Lakes/') &&
        !seen.has(full) &&
        label &&
        /lake|pool|dam/i.test(label) &&
        !/texas|kansas|arkansas district/i.test(label)
      ) {
        seen.add(full);
        out.push({ name: label, url: full });
      }
    }
    return out;
  }, INDEX);
  return links.slice(0, LIMIT);
}

async function findSubPages(page: Page, lakeUrl: string): Promise<string[]> {
  return page.evaluate((base) => {
    const out: string[] = [];
    for (const a of Array.from(document.querySelectorAll('a[href]'))) {
      const href = (a as HTMLAnchorElement).getAttribute('href');
      if (!href) continue;
      const full = new URL(href, base).toString();
      const label = ((a as HTMLAnchorElement).textContent ?? '').toLowerCase();
      if (/recreation|campgrounds|public use|accessibility|accessible/.test(label) &&
          full.startsWith(new URL(base).origin) && !out.includes(full)) {
        out.push(full);
      }
    }
    return out.slice(0, 6);
  }, lakeUrl);
}

async function extractAreas(page: Page, url: string, lakeName: string): Promise<ScrapeRecord[]> {
  const now = new Date().toISOString();
  const isAccessibilityPage = /accessib/i.test(url);
  const items = await page.evaluate(() => {
    const docs: string[] = [];
    document
      .querySelectorAll('main li, article li, main td, article td, main h4, article h4')
      .forEach((el) => {
        const t = (el.textContent ?? '').replace(/s+/g, ' ').trim();
        if (t.length >= 3 && t.length <= 90 && !/^[W_]+$/.test(t)) docs.push(t);
      });
    return docs;
  });

  const records: ScrapeRecord[] = [];
  for (const item of items) {
    if (/(^menu$|^home$|news|share|download|pdf|^close$|^search$)/i.test(item)) continue;
    const ada = /(wheelchair|ada|disabled|accessib|mobilit)/i.test(item);
    if (!isAccessibilityPage && !/(park|landing|cove|point|bend|bay|creek|site|ramp|resort|marina|dam|spillway|oak)/i.test(item)) continue;
    records.push({
      name: item,
      category: isAccessibilityPage ? 'usace-ada-facility' : 'usace-public-use-area',
      waterbody: lakeName,
      ada: isAccessibilityPage || ada,
      amenities: [
        isAccessibilityPage ? 'accessibility info' : '',
        /ramp/i.test(item) ? 'boat ramp' : '',
        /marina/i.test(item) ? 'marina' : '',
      ].filter(Boolean),
      notes: isAccessibilityPage ? 'extracted from lake accessibility page' : '',
      source_url: url,
      scraped_at: now,
    });
  }
  return records;
}

const run = withBrowser(async (ctx) => {
  const page = await ctx.newPage();
  const lakes = await collectLakeLinks(page);
  console.log(`found ${lakes.length} lake pages`);
  if (DEBUG) await debugDump(page, 'usace-index');

  const all: ScrapeRecord[] = [];
  for (const lake of lakes) {
    try {
      await gotoPolite(page, lake.url);
      if (DEBUG) await debugDump(page, `usace-${lake.name.replace(/W+/g, '_')}`);
      all.push(...await extractAreas(page, lake.url, lake.name));
      const subs = await findSubPages(page, lake.url);
      for (const sub of subs) {
        await gotoPolite(page, sub);
        all.push(...await extractAreas(page, sub, lake.name));
      }
    } catch (err) {
      console.warn(`skipping ${lake.name}: ${(err as Error).message}`);
    }
  }

  writeOutputs(all, 'usace-ok-lakes');
  if (process.argv.includes('--push')) await pushToWorker(all);
  await page.close();
});

run.catch((err) => { console.error(err); process.exit(1); });
