import { describe, expect, it } from 'vitest';
import { isHttpUrl, isImageDataUrl } from './urls';

describe('isHttpUrl', () => {
  it('accepts valid http and https URLs', () => {
    expect(isHttpUrl('https://example.com/fish')).toBe(true);
    expect(isHttpUrl('http://wildlifedepartment.com/spot/1')).toBe(true);
    expect(isHttpUrl('https://sub.domain.org/path?query=val#hash')).toBe(true);
  });

  it('rejects URLs with embedded credentials', () => {
    expect(isHttpUrl('https://user:pass@example.com/')).toBe(false);
    expect(isHttpUrl('http://admin@example.com')).toBe(false);
  });

  it('rejects javascript, data, file, and other non-http protocols', () => {
    expect(isHttpUrl('javascript:alert(1)')).toBe(false);
    expect(isHttpUrl('data:text/html,<h1>bad</h1>')).toBe(false);
    expect(isHttpUrl('file:///etc/passwd')).toBe(false);
    expect(isHttpUrl('ftp://ftp.example.com')).toBe(false);
  });

  it('rejects invalid types and oversized strings', () => {
    expect(isHttpUrl(null)).toBe(false);
    expect(isHttpUrl(undefined)).toBe(false);
    expect(isHttpUrl(123)).toBe(false);
    expect(isHttpUrl('')).toBe(false);
    expect(isHttpUrl('not a url')).toBe(false);
    expect(isHttpUrl('https://example.com/' + 'a'.repeat(2100))).toBe(false);
  });
});

describe('isImageDataUrl', () => {
  it('accepts valid base64 data URLs for jpeg, png, and webp', () => {
    expect(isImageDataUrl('data:image/jpeg;base64,/9j/4AAQSkZJRg==')).toBe(true);
    expect(isImageDataUrl('data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==')).toBe(true);
    expect(isImageDataUrl('data:image/webp;base64,UklGRkAAAABXRUJQVlA4==')).toBe(true);
  });

  it('rejects unsupported image types, non-base64, or malicious data URLs', () => {
    expect(isImageDataUrl('data:image/svg+xml;base64,PHN2Zz4=')).toBe(false);
    expect(isImageDataUrl('data:text/html;base64,PHNjcmlwdD4=')).toBe(false);
    expect(isImageDataUrl('data:image/jpeg;utf8,rawbytes')).toBe(false);
    expect(isImageDataUrl('https://example.com/photo.jpg')).toBe(false);
    expect(isImageDataUrl(null)).toBe(false);
  });
});
