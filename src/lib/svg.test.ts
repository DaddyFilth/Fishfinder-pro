import { describe, expect, it } from 'vitest';
import { isSafeGeneratedSvg } from './svg';

describe('isSafeGeneratedSvg', () => {
  const validSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
    <rect width="1024" height="1024" fill="#001122"/>
    <path d="M100 200 C300 100, 500 300, 700 200" stroke="#4488aa" fill="none"/>
    <circle cx="512" cy="512" r="50" fill="#ffaa00"/>
  </svg>`;

  it('accepts clean standalone SVG markup matching the standard viewBox', () => {
    expect(isSafeGeneratedSvg(validSvg)).toBe(true);
  });

  it('rejects script tags and foreignObject', () => {
    expect(isSafeGeneratedSvg(validSvg.replace('</svg>', '<script>alert(1)</script></svg>'))).toBe(false);
    expect(isSafeGeneratedSvg(validSvg.replace('</svg>', '<foreignObject><body>bad</body></foreignObject></svg>'))).toBe(false);
  });

  it('rejects inline event handlers', () => {
    expect(isSafeGeneratedSvg(validSvg.replace('<circle', '<circle onload="alert(1)"'))).toBe(false);
    expect(isSafeGeneratedSvg(validSvg.replace('<circle', '<circle onclick="evil()"'))).toBe(false);
  });

  it('rejects external links and references', () => {
    expect(isSafeGeneratedSvg(validSvg.replace('<circle', '<a href="https://attacker.com"><circle'))).toBe(false);
    expect(isSafeGeneratedSvg(validSvg.replace('<circle', '<circle xlink:href="https://attacker.com"'))).toBe(false);
    expect(isSafeGeneratedSvg(validSvg.replace('fill="#ffaa00"', 'fill="url(https://attacker.com/leak)"'))).toBe(false);
  });

  it('rejects embedded objects, iframes, images, and use elements', () => {
    expect(isSafeGeneratedSvg(validSvg.replace('</svg>', '<image href="http://evil.com/x.png"/></svg>'))).toBe(false);
    expect(isSafeGeneratedSvg(validSvg.replace('</svg>', '<use href="#icon"/></svg>'))).toBe(false);
    expect(isSafeGeneratedSvg(validSvg.replace('</svg>', '<iframe></iframe></svg>'))).toBe(false);
  });

  it('rejects doctype and comments that could hide payload or cause entity expansion', () => {
    expect(isSafeGeneratedSvg(`<!DOCTYPE svg SYSTEM "file:///etc/passwd">${validSvg}`)).toBe(false);
    expect(isSafeGeneratedSvg(`<!-- comment -->${validSvg}`)).toBe(false);
  });

  it('rejects non-strings or invalid dimensions', () => {
    expect(isSafeGeneratedSvg(null)).toBe(false);
    expect(isSafeGeneratedSvg(123)).toBe(false);
    expect(isSafeGeneratedSvg('<svg viewBox="0 0 500 500"></svg>')).toBe(false);
  });
});
