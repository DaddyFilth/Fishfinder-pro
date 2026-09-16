import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const proxySource = readFileSync(new URL('./proxy.ts', import.meta.url), 'utf8');
const matcher = proxySource.match(/matcher:\s*'([^']+)'/)?.[1].replaceAll('\\\\', '\\');

if (!matcher) {
  throw new Error('Unable to find the proxy matcher.');
}

const proxyMatcher = new RegExp(`^${matcher}`);

describe('proxy matcher', () => {
  it('excludes exact public asset filenames', () => {
    expect(proxyMatcher.test('/favicon.ico')).toBe(false);
    expect(proxyMatcher.test('/robots.txt')).toBe(false);
    expect(proxyMatcher.test('/sitemap.xml')).toBe(false);
    expect(proxyMatcher.test('/manifest.json')).toBe(false);
    expect(proxyMatcher.test('/.well-known/assetlinks.json')).toBe(false);
  });

  it('still matches similarly named application routes', () => {
    expect(proxyMatcher.test('/faviconXico')).toBe(true);
    expect(proxyMatcher.test('/robotsXtxt')).toBe(true);
    expect(proxyMatcher.test('/sitemapAxml')).toBe(true);
    expect(proxyMatcher.test('/manifestXjson')).toBe(true);
  });
});
