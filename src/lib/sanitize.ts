export function escapeHtml(input: string | null | undefined): string {
  return String(input ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function sanitizeText(input: string | null | undefined): string {
  return escapeHtml(String(input ?? '').trim());
}

export function sanitizeNumber(input: unknown, fallback = 0): number {
  const n = typeof input === 'number' ? input : Number(input);
  return Number.isFinite(n) ? n : fallback;
}

export function sanitizeCoords(lat: unknown, lng: unknown) {
  const latitude = sanitizeNumber(lat, 0);
  const longitude = sanitizeNumber(lng, 0);
  return { latitude, longitude };
}

const sanitize = {
  escapeHtml,
  sanitizeText,
  sanitizeNumber,
  sanitizeCoords,
};

export default sanitize;
