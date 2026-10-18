import type { Spot } from '@/lib/mapFilters';

/**
 * Location-name search behind the map's search bar.
 *
 * The app ships one catalog of Oklahoma public waters, so searching is ranking that
 * catalog instead of a geocoder call: a name or region match is always available, even
 * offline. Everything here is pure so the ranking rules can be unit tested without a DOM.
 */

/** How many query words are honoured before the rest are ignored. */
const MAX_TOKENS = 6;

/** Lowercases, strips accents, and collapses whitespace so "Héfner  Lake" finds "Lake Hefner". */
export function normalizeLocationText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** Region, water type, and access labels a spot can be found by besides its name. */
function metadataText(spot: Spot): string {
  return normalizeLocationText(
    [spot.region, spot.water_type, spot.spot_type, spot.access_type].filter(Boolean).join(' '),
  );
}

function isWordStart(text: string, index: number): boolean {
  return index === 0 || text[index - 1] === ' ';
}

/** Cheapest placement for one query word: name start, name word, name, then metadata. */
function tokenScore(name: string, metadata: string, token: string): number | null {
  const nameIndex = name.indexOf(token);

  if (nameIndex === 0) return 0;
  if (nameIndex > 0) return isWordStart(name, nameIndex) ? 1 : 2;
  if (metadata.includes(token)) return 3;
  return null;
}

function scoreSpot(spot: Spot, query: string, tokens: string[]): number | null {
  const name = normalizeLocationText(spot.name);
  const metadata = metadataText(spot);

  let total = 0;

  for (const token of tokens) {
    const score = tokenScore(name, metadata, token);
    if (score === null) return null;
    total += score;
  }

  // Whole-phrase matches outrank the same words scattered across fields.
  const phraseIndex = name.indexOf(query);
  if (phraseIndex === 0) total -= 2;
  else if (phraseIndex > 0) total -= 1;

  return total;
}

/**
 * Waters matching every word of the query, best match first.
 *
 * A blank query returns nothing so the map never renders the whole catalog as a list,
 * and `limit` keeps the dropdown to one screenful.
 */
export function searchLocations(spots: Spot[], rawQuery: string, limit = 8): Spot[] {
  const query = normalizeLocationText(rawQuery);
  if (!query) return [];

  const tokens = query.split(' ').filter(Boolean).slice(0, MAX_TOKENS);

  return spots
    .map((spot) => ({ spot, score: scoreSpot(spot, query, tokens) }))
    .filter((entry): entry is { spot: Spot; score: number } => entry.score !== null)
    .sort((a, b) => a.score - b.score || a.spot.name.localeCompare(b.spot.name))
    .slice(0, Math.max(limit, 0))
    .map((entry) => entry.spot);
}
