export const MAX_GENERATED_SVG_BYTES = 1_500_000;

const FORBIDDEN_SVG_PATTERN = /<\/?(?:script|foreignObject|iframe|object|embed|image|use|style|animate|animateMotion|animateTransform|set|filter|pattern|mask|marker|symbol|switch|a)\b|\bon[a-z]+\s*=|\b(?:href|xlink:href|src|formaction)\s*=|\burl\s*\(/i;
const ALLOWED_SVG_ROOT = /^<svg\b[^>]*>[\s\S]*<\/svg>\s*$/i;

/**
 * Generated artwork is rendered as an image, but it is still untrusted markup.
 * Keep the accepted surface deliberately small instead of trying to repair
 * arbitrary provider output with regular-expression substitutions.
 */
export function isSafeGeneratedSvg(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if (new TextEncoder().encode(value).byteLength > MAX_GENERATED_SVG_BYTES) return false;
  if (!ALLOWED_SVG_ROOT.test(value.trim())) return false;
  if (FORBIDDEN_SVG_PATTERN.test(value)) return false;
  if (/<\/?(?:!doctype|!--)/i.test(value)) return false;

  const openingTag = value.match(/^<svg\b([^>]*)>/i)?.[1] ?? '';
  if (!/\bviewBox\s*=\s*["']\s*0\s+0\s+1024\s+1024\s*["']/i.test(openingTag)) return false;

  return true;
}
