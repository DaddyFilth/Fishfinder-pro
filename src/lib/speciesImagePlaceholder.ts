/**
 * Fallback artwork for the species guide.
 *
 * `src/components/SpeciesTab.tsx` swaps a broken catalog image for
 * `/api/species-image/<species>`, so that route must always answer with an
 * image. Returning JSON on failure left visitors with a broken image icon,
 * which is why the placeholder lives here as a pure, testable helper.
 */

const XML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};

/** Escape text before interpolating it into SVG markup. */
export function escapeXmlText(value: string): string {
  return value.replace(/[&<>"']/g, (char) => XML_ESCAPES[char] ?? char);
}

/** Deterministic SVG placeholder shown when no generated artwork is available. */
export function speciesImagePlaceholder(speciesName: string): string {
  const label = escapeXmlText(speciesName.trim() || 'Unknown species');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" role="img" aria-label="${label} field guide illustration">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0c1e3a" />
      <stop offset="1" stop-color="#060d1a" />
    </linearGradient>
  </defs>
  <rect width="1024" height="1024" fill="url(#bg)" />
  <path d="M176 512c122-172 336-252 528-192 72 22 122 60 146 100-32 40-82 78-152 100-188 60-390-18-522-190z" fill="#1e3a8a" opacity="0.55" />
  <path d="M850 512l96-74v148z" fill="#1e3a8a" opacity="0.55" />
  <circle cx="268" cy="478" r="17" fill="#93c5fd" />
  <text x="512" y="824" text-anchor="middle" font-family="system-ui, sans-serif" font-size="46" font-weight="700" fill="#cbd5e1">${label}</text>
  <text x="512" y="878" text-anchor="middle" font-family="system-ui, sans-serif" font-size="30" fill="#64748b">Illustration unavailable</text>
</svg>`;
}