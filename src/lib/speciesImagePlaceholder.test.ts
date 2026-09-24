import { describe, expect, it } from 'vitest';
import { escapeXmlText, speciesImagePlaceholder } from './speciesImagePlaceholder';

describe('escapeXmlText', () => {
  it('escapes every character that could break SVG markup', () => {
    expect(escapeXmlText(`Largemouth <bass> & "friends" 'too'`)).toBe(
      'Largemouth &lt;bass&gt; &amp; &quot;friends&quot; &apos;too&apos;',
    );
  });

  it('leaves ordinary species names untouched', () => {
    expect(escapeXmlText('White Crappie')).toBe('White Crappie');
  });
});

describe('speciesImagePlaceholder', () => {
  it('returns standalone SVG markup usable as an <img> source', () => {
    const svg = speciesImagePlaceholder('Blue Catfish');

    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg.trimEnd().endsWith('</svg>')).toBe(true);
    expect(svg).toContain('Blue Catfish');
  });

  it('never emits executable or external references', () => {
    const svg = speciesImagePlaceholder('<script>alert(1)</script> Walleye');

    expect(svg).not.toContain('<script');
    expect(svg).not.toContain('javascript:');
    expect(svg).not.toContain('href');
    expect(svg).toContain('&lt;script&gt;');
  });

  it('falls back to a generic label when the name is blank', () => {
    expect(speciesImagePlaceholder('   ')).toContain('Unknown species');
  });
});