import {
  buildContextMessage,
  buildSpeciesCatalogMessage,
  buildSuppliedContextMessage,
  buildWebSearchMessage,
  findMentionedSpecies,
  findSpeciesByQuery,
  type SpotsContext,
} from '@/lib/fishbotPrompt';

/**
 * Everything the brain is allowed to see. The brain never invents data: every
 * block below is either provider-reported, stored-catalog, or explicitly
 * labeled application-supplied reference data.
 */
export interface BrainSpotContext {
  id?: string;
  name?: string;
  lat?: number;
  lng?: number;
  water_type?: string;
  spot_type?: string;
  access_type?: string;
  region?: string;
  description?: string;
  ada?: boolean;
  [key: string]: unknown;
}

export interface BrainContext {
  /** Canonical spot identity for spot-scoped chats. */
  spot?: BrainSpotContext | null;
  /** Provider/application conditions for the spot (may be empty). */
  conditions?: Record<string, unknown> | null;
  /** Coordinates used to pull the provider feed when a spot is not supplied. */
  location?: { lat?: number; lon?: number } | null;
  /** Explicit target species labels (form field or spot record). */
  species?: string[] | null;
  /** Provider feed parsed for the user's coordinates. */
  providerContext?: SpotsContext | null;
  /** Refresh of a DuckDuckGo lookup; always labeled search-derived. */
  webSearch?: { summary: string; related: Array<{ text: string; url: string | null }> } | null;
  /** Prior turns in the conversation, oldest first. */
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  /** Extra, already-labeled grounding appended after the standard blocks. */
  extra?: string | null;
}

/** What grounding the brain actually had, so callers can be honest about gaps. */
export interface GroundingReport {
  spot: boolean;
  conditions: boolean;
  providerContext: boolean;
  species: boolean;
  webSearch: boolean;
  /** Human-readable list of what was missing. */
  unavailable: string[];
}

const coordinate = (value: unknown): number | undefined => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

/** Resolves the coordinates for a context, preferring explicit location over the spot. */
export function resolveCoordinates(context: BrainContext): { lat?: number; lon?: number } {
  const spot = context.spot ?? undefined;
  const lat = coordinate(context.location?.lat) ?? coordinate(spot?.lat);
  const lon = coordinate(context.location?.lon) ?? coordinate(spot?.lng);
  return { lat, lon };
}

function hasAnyValue(record: Record<string, unknown> | null | undefined): boolean {
  if (!record) return false;
  return Object.keys(record).length > 0;
}

/** Describes which grounding sources were present and which were unavailable. */
export function buildGroundingReport(context: BrainContext): GroundingReport {
  const spot = Boolean(context.spot && (context.spot.id || context.spot.name));
  const conditions = hasAnyValue(context.conditions ?? null);
  const providerContext = Boolean(context.providerContext);
  const species = Boolean(context.species && context.species.length > 0);
  const webSearch = Boolean(context.webSearch && context.webSearch.summary.trim());

  const unavailable: string[] = [];
  if (!conditions && !providerContext) unavailable.push('current conditions');
  if (!species) unavailable.push('an explicit target species');

  return { spot, conditions, providerContext, species, webSearch, unavailable };
}

/** Resolves mentioned/requested species against the stored catalog. */
export function resolveSpecies(context: BrainContext, question: string): ReturnType<typeof findMentionedSpecies> {
  if (context.species && context.species.length > 0) {
    const explicit = context.species.flatMap((label) => findSpeciesByQuery(label));
    if (explicit.length > 0) return explicit;
  }
  return findMentionedSpecies(question);
}

/**
 * Builds the ordered grounding blocks handed to the model as system messages.
 * Blocks that are empty are dropped so the model is not told a source exists
 * when it does not.
 */
export function buildGroundingBlocks(context: BrainContext, question: string): string[] {
  const spot = resolveSpecies(context, question);
  return [
    buildContextMessage(context.providerContext ?? null),
    context.spot || context.conditions
      ? buildSuppliedContextMessage(context.spot ?? undefined, context.conditions ?? undefined)
      : '',
    buildSpeciesCatalogMessage(spot),
    context.webSearch
      ? buildWebSearchMessage(context.webSearch.summary, context.webSearch.related)
      : '',
    context.extra?.trim() ?? '',
  ].filter((block) => block.trim().length > 0);
}
