import {
  getAiModel,
  getAiProviderName,
  getAiProviderTargets,
  getAiVisionModel,
  type AiProvider,
} from '@/lib/groq';
import { FISHBOT_SYSTEM_PROMPT } from '@/lib/fishbotPrompt';
import type { Species } from '@/lib/speciesCatalog';
import {
  buildGroundingBlocks,
  buildGroundingReport,
  resolveSpecies,
  type BrainContext,
  type GroundingReport,
} from './context';

export type BrainRole = 'system' | 'user' | 'assistant';

export type BrainContent = string | Array<Record<string, unknown>>;

export interface BrainMessage {
  role: BrainRole;
  content: BrainContent;
}

export interface BrainParams {
  messages: BrainMessage[];
  model?: string;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  response_format?: { type: 'json_object' };
}

export interface BrainProviderResult {
  choices: Array<{ message: { content: string | null } }>;
}

export interface BrainOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  model?: string;
  responseFormat?: { type: 'json_object' };
}

export interface BrainResult {
  /**
   * The model's reply text (trimmed). Always non-empty: when every configured
   * provider fails the brain returns a local fallback message and sets
   * `degraded: true` rather than throwing or returning an empty string.
   */
  text: string;
  provider: AiProvider;
  model: string;
  grounding: GroundingReport;
  /**
   * True when no provider returned text; `text` is then a complete answer
   * assembled locally from the stored species catalog, supplied conditions, and
   * provider feed rather than a model completion. Callers should label it as
   * app-assembled, never as model-generated.
   */
  degraded: boolean;
}

export interface ProviderCompletion {
  text: string;
  provider: AiProvider;
  model: string;
}

/**
 * Walks the configured provider chain (Groq, then OpenAI, then OpenCode) and
 * returns the first non-empty completion. Each provider is tried with its own
 * model, so a model name valid for one provider is never sent to another.
 * @throws {Error} When no provider is configured or every provider fails.
 */
async function completeChat(params: BrainParams, useVision = false): Promise<ProviderCompletion> {
  const targets = getAiProviderTargets();
  if (targets.length === 0) throw new Error('No AI provider credentials are configured.');

  let lastError: unknown;
  for (let index = 0; index < targets.length; index += 1) {
    const target = targets[index];
    const model = index === 0 && params.model ? params.model : useVision ? target.visionModel : target.model;
    try {
      const response = await target.client.chat.completions.create({
        model,
        messages: params.messages,
        ...(params.temperature !== undefined && { temperature: params.temperature }),
        ...(params.max_tokens !== undefined && { max_tokens: params.max_tokens }),
        ...(params.top_p !== undefined && { top_p: params.top_p }),
        ...(params.response_format !== undefined && { response_format: params.response_format }),
        stream: false,
      });
      const text = response.choices[0]?.message?.content?.trim();
      if (text) return { text, provider: target.provider, model };
      lastError = new Error(`${target.provider} returned no text`);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('AI provider returned no text');
}

const celsiusToFahrenheit = (celsius: number): number => Math.round((celsius * 9) / 5 + 32);

const MAX_CONDITION_LINES = 8;
const MAX_CATALOG_SPECIES = 2;

interface ConditionFormat {
  label: string;
  unit?: string;
  convertCelsius?: boolean;
}

/**
 * Recognized condition keys (lowercased) so the local answer can render real
 * units. Unknown keys are still included, humanized and without an invented
 * unit, so the answer stays complete and honest.
 */
const CONDITION_FORMATS: Record<string, ConditionFormat> = {
  water_temp_c: { label: 'Water temperature', convertCelsius: true },
  watertempc: { label: 'Water temperature', convertCelsius: true },
  water_temp_f: { label: 'Water temperature', unit: '°F' },
  watertempf: { label: 'Water temperature', unit: '°F' },
  sea_surface_temp_c: { label: 'Water temperature', convertCelsius: true },
  seasurfacetempc: { label: 'Water temperature', convertCelsius: true },
  sea_surface_temp_f: { label: 'Water temperature', unit: '°F' },
  seasurfacetempf: { label: 'Water temperature', unit: '°F' },
  air_temp_c: { label: 'Air temperature', convertCelsius: true },
  airtempc: { label: 'Air temperature', convertCelsius: true },
  air_temp_f: { label: 'Air temperature', unit: '°F' },
  airtempf: { label: 'Air temperature', unit: '°F' },
  temperaturef: { label: 'Air temperature', unit: '°F' },
  wind_speed_ms: { label: 'Wind speed', unit: 'm/s' },
  windspeedms: { label: 'Wind speed', unit: 'm/s' },
  wind_speed_mph: { label: 'Wind speed', unit: 'mph' },
  windspeedmph: { label: 'Wind speed', unit: 'mph' },
  wind_speed_kph: { label: 'Wind speed', unit: 'km/h' },
  windspeedkph: { label: 'Wind speed', unit: 'km/h' },
  wind_direction: { label: 'Wind direction' },
  winddirection: { label: 'Wind direction' },
  pressure_hpa: { label: 'Pressure', unit: 'hPa' },
  pressurehpa: { label: 'Pressure', unit: 'hPa' },
  cloud_cover_pct: { label: 'Cloud cover', unit: '%' },
  cloudcoverpct: { label: 'Cloud cover', unit: '%' },
  humidity_pct: { label: 'Humidity', unit: '%' },
  humiditypct: { label: 'Humidity', unit: '%' },
  dissolved_oxygen_mgl: { label: 'Dissolved oxygen', unit: 'mg/L' },
  dissolvedoxygenmgl: { label: 'Dissolved oxygen', unit: 'mg/L' },
  flow_rate_cfs: { label: 'Flow', unit: 'cfs' },
  flowratecfs: { label: 'Flow', unit: 'cfs' },
  wave_height_m: { label: 'Wave height', unit: 'm' },
  waveheightm: { label: 'Wave height', unit: 'm' },
  fishing_score: { label: 'Calculated fishing score', unit: '/100' },
  fishingscore: { label: 'Calculated fishing score', unit: '/100' },
};

function humanizeKey(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 10) / 10);
}

/** Degree, percent, and score units attach directly; every other unit gets a space. */
function formatUnit(unit: string | undefined): string {
  if (!unit) return '';
  return ['°F', '%', '/100'].includes(unit) ? unit : ` ${unit}`;
}

/** Renders caller-supplied condition values, converting stored Celsius to Fahrenheit. */
function describeConditions(
  conditions: Record<string, unknown> | null,
): { lines: string[]; waterTempF: number | null } {
  const lines: string[] = [];
  let waterTempF: number | null = null;
  if (!conditions) return { lines, waterTempF };

  for (const [key, value] of Object.entries(conditions)) {
    if (lines.length >= MAX_CONDITION_LINES) break;
    const format = CONDITION_FORMATS[key.toLowerCase()];
    const label = format?.label ?? humanizeKey(key);

    if (typeof value === 'number' && Number.isFinite(value)) {
      if (format?.convertCelsius) {
        const fahrenheit = celsiusToFahrenheit(value);
        if (/water temperature/i.test(label)) waterTempF = fahrenheit;
        lines.push(`${label} ${formatNumber(fahrenheit)}°F (converted from ${formatNumber(value)}°C)`);
      } else {
        if (format?.unit === '°F' && /water temperature/i.test(label)) waterTempF = value;
        lines.push(`${label} ${formatNumber(value)}${formatUnit(format?.unit)}`);
      }
    } else if (typeof value === 'string' && value.trim()) {
      lines.push(`${label}: ${value.trim().slice(0, 160)}`);
    } else if (typeof value === 'boolean') {
      lines.push(`${label}: ${value ? 'yes' : 'no'}`);
    }
  }

  return { lines, waterTempF };
}

/** Renders the provider feed the route already fetched, with its own labels. */
function describeProvider(provider: BrainContext['providerContext']): string[] {
  if (!provider) return [];
  const lines: string[] = [];
  const conditions = provider.conditions;

  if (typeof conditions?.temperatureF === 'number') {
    lines.push(`Air temperature ${formatNumber(conditions.temperatureF)}°F`);
  }
  if (typeof conditions?.windSpeedMph === 'number') {
    lines.push(`Wind speed ${formatNumber(conditions.windSpeedMph)} mph${conditions.windDirection ? ` ${conditions.windDirection}` : ''}`);
  }
  if (conditions?.shortForecast?.trim()) {
    lines.push(`Sky: ${conditions.shortForecast.trim()}`);
  }
  if (typeof provider.overallBite?.score === 'number') {
    lines.push(`Provider bite score ${formatNumber(provider.overallBite.score)}/100${provider.overallBite.level ? ` (${provider.overallBite.level})` : ''}`);
  }
  const topSpecies = provider.speciesLikely?.[0];
  if (topSpecies?.species) {
    lines.push(`Most likely species ${topSpecies.species}${typeof topSpecies.probability === 'number' ? ` (${Math.round(topSpecies.probability * 100)}% provider model probability)` : ''}`);
  }
  const topBait = provider.recommendedBaits?.find((bait) => bait.baitType)?.baitType;
  if (topBait) lines.push(`Provider-suggested bait ${topBait}`);
  if (provider.summary?.trim()) lines.push(`Provider summary: ${provider.summary.trim().slice(0, 300)}`);

  return lines;
}

/** Labels where the condition values came from, without calling them live. */
function describeDataSources(context: BrainContext): string {
  const provider = context.providerContext;
  if (!provider) return 'application-supplied data, not independently verified';
  const source = provider.source ?? 'unspecified provider';
  const mode = provider.data_mode ?? 'unspecified mode';
  const observedAt = provider.observed_at ?? provider.conditions?.issuedAt;
  return `provider feed ${source}, mode ${mode}${observedAt ? `, observed ${observedAt}` : ''}`;
}

/** One complete, catalog-grounded species line, using the supplied water temperature when present. */
function describeSpecies(entry: Species, waterTempF: number | null): string {
  const minF = celsiusToFahrenheit(entry.advice.optTempMin);
  const maxF = celsiusToFahrenheit(entry.advice.optTempMax);
  const parts = [
    `${entry.name} (${entry.scientificName}) — stored catalog entry: habitat ${entry.habitat}; season ${entry.season.join(', ')}; catalog bait ${entry.bestBait.join(', ')}; best time ${entry.bestTime}; typical depth ${entry.depth}; stored optimal water ${minF}–${maxF}°F`,
  ];

  if (waterTempF === null) {
    parts.push(`catalog tip: ${entry.tips}`);
    return parts.join('; ');
  }

  if (waterTempF < minF) {
    parts.push(`the supplied water temperature (${waterTempF}°F) is below that range, so the catalog's cool-water play is ${entry.advice.baitsCold.join(', ')} with ${entry.advice.techniqueCold}`);
  } else if (waterTempF > maxF) {
    parts.push(`the supplied water temperature (${waterTempF}°F) is above that range, so the catalog's warm-water play is ${entry.advice.baitsWarm.join(', ')} with ${entry.advice.techniqueWarm}`);
  } else {
    parts.push(`the supplied water temperature (${waterTempF}°F) sits inside that range, so the catalog's ${entry.bestBait.join(', ')} is the grounded starting point`);
  }
  parts.push(`catalog tip: ${entry.tips}`);

  return parts.join('; ');
}

/**
 * Complete answer assembled locally when no provider can reply. Every line is
 * taken from the caller's context — supplied conditions, the provider feed, the
 * stored species catalog, and labeled search results — and the reply states
 * plainly which sources were missing and that no model produced it.
 */
export function buildFallbackReply(context: BrainContext = {}, question = ''): string {
  const grounding = buildGroundingReport(context);
  const spotName = typeof context.spot?.name === 'string' ? context.spot.name.trim() : '';
  const { lines: suppliedLines, waterTempF } = describeConditions(context.conditions ?? null);
  const conditionLines = [...describeProvider(context.providerContext ?? null), ...suppliedLines];
  const species = resolveSpecies(context, question).slice(0, MAX_CATALOG_SPECIES);

  const blocks: string[] = [
    spotName
      ? `Here is what Fishfinder Pro can tell you about ${spotName}:`
      : 'Here is what Fishfinder Pro can tell you from its stored data:',
  ];

  if (conditionLines.length > 0) {
    blocks.push(
      `Conditions on file (${describeDataSources(context)}):\n${conditionLines.map((line) => `- ${line}`).join('\n')}`,
    );
  } else {
    blocks.push('No current conditions were supplied with this request, so none are reported here.');
  }

  if (species.length > 0) {
    blocks.push(
      `Stored catalog guidance:\n${species.map((entry) => `- ${describeSpecies(entry, waterTempF)}`).join('\n')}`,
    );
  }

  const searchSummary = context.webSearch?.summary?.trim();
  if (searchSummary) {
    blocks.push(
      `Search-derived notes (DuckDuckGo — third-party research, not verified observations):\n- ${searchSummary.slice(0, 400)}`,
    );
  }

  if (grounding.unavailable.length > 0) {
    blocks.push(`Not included because nothing supplied it: ${grounding.unavailable.join(', ')}.`);
  }

  blocks.push(
    'Assembled by Fishfinder Pro from the stored species catalog and supplied provider data; no AI model was used for this reply.',
  );

  return blocks.join('\n\n');
}

/**
 * The single server-side brain. Every AI call in the app routes through here so
 * they share one provider policy (Groq → OpenAI → OpenCode) and one grounding
 * contract. `runBrainPrompt` is the raw-text gate for task-specific routes;
 * `askBrain` is the grounded conversational entry point.
 */
export async function callFishbot(params: BrainParams): Promise<BrainProviderResult> {
  const result = await completeChat(params);
  return { choices: [{ message: { content: result.text } }] };
}

/**
 * Low-level provider call that returns the model's text across the provider
 * chain, or throws when every provider fails. Task-specific routes should prefer
 * this over reaching into a provider so the brain stays the only place that
 * talks to an LLM.
 */
export async function runBrainPrompt(params: BrainParams): Promise<string> {
  const result = await completeChat(params);
  return result.text;
}

/**
 * Like `runBrainPrompt`, but also returns the provider and model that produced
 * the text, so routes can report which provider actually answered instead of
 * assuming the first one in the chain.
 */
export async function runBrainPromptCompletion(params: BrainParams): Promise<ProviderCompletion> {
  return completeChat(params);
}

/** Assembles the canonical grounded conversation for a chat turn. */
export function buildBrainMessages(question: string, context: BrainContext = {}): BrainMessage[] {
  const grounding = buildGroundingBlocks(context, question);
  const history = (context.history ?? [])
    .filter((turn) => turn && typeof turn.content === 'string' && turn.content.trim().length > 0)
    .slice(-6);

  return [
    { role: 'system', content: FISHBOT_SYSTEM_PROMPT },
    ...grounding.map((block): BrainMessage => ({ role: 'system', content: block })),
    ...history.map((turn): BrainMessage => ({ role: turn.role, content: turn.content })),
    { role: 'user', content: question },
  ];
}

/**
 * Grounded conversational answer. Answers only from `context`; the system
 * prompt requires the model to say "unavailable" rather than invent readings.
 * Never throws for provider failure — it returns a `degraded` fallback so route
 * handlers can answer 200 with an honest message.
 *
 * @param question The user's natural-language question.
 * @param context Grounding data (spot, conditions, provider feed, species, search).
 * @param options Optional sampling controls.
 */
export async function askBrain(
  question: string,
  context: BrainContext = {},
  options: BrainOptions = {},
): Promise<BrainResult> {
  const trimmed = question.trim();
  if (!trimmed) throw new Error('A question is required.');

  const messages = buildBrainMessages(trimmed, context);
  const grounding = buildGroundingReport(context);

  try {
    const result = await completeChat({
      messages,
      ...(options.model !== undefined && { model: options.model }),
      temperature: options.temperature ?? 0.6,
      max_tokens: options.maxTokens ?? 900,
      ...(options.topP !== undefined && { top_p: options.topP }),
      ...(options.responseFormat !== undefined && { response_format: options.responseFormat }),
    });
    return { text: result.text, provider: result.provider, model: result.model, grounding, degraded: false };
  } catch (error) {
    console.error('[brain] Every AI provider failed; returning local fallback:', error instanceof Error ? error.message : error);
    return {
      text: buildFallbackReply(context, trimmed),
      provider: getAiProviderName(),
      model: options.model ?? getAiModel(),
      grounding,
      degraded: true,
    };
  }
}

/** Grounded call that asks the provider for a JSON object (the caller parses it). */
export function askBrainJson(
  question: string,
  context: BrainContext = {},
  options: BrainOptions = {},
): Promise<BrainResult> {
  return askBrain(question, context, { ...options, responseFormat: { type: 'json_object' } });
}

/**
 * Vision variant for photo identification. Like `askBrain`, it never throws for
 * provider failure: it returns a `degraded` result with an empty-safe message.
 */
export async function askBrainVision(
  question: string,
  imageDataUrl: string,
  options: BrainOptions = {},
): Promise<BrainResult> {
  const grounding = buildGroundingReport({});
  try {
    const result = await completeChat(
      {
        ...(options.model !== undefined && { model: options.model }),
        max_tokens: options.maxTokens ?? 600,
        ...(options.temperature !== undefined && { temperature: options.temperature }),
        ...(options.responseFormat !== undefined && { response_format: options.responseFormat }),
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: question },
              { type: 'image_url', image_url: { url: imageDataUrl } },
            ],
          },
        ],
      },
      true,
    );
    return { text: result.text, provider: result.provider, model: result.model, grounding, degraded: false };
  } catch (error) {
    console.error('[brain] Every AI vision provider failed:', error instanceof Error ? error.message : error);
    return {
      text: 'The AI image identification model is temporarily unavailable. Please try again in a moment.',
      provider: getAiProviderName(),
      model: options.model ?? getAiVisionModel(),
      grounding,
      degraded: true,
    };
  }
}

export { getAiModel, getAiProviderName, getAiVisionModel };
export type { AiProvider, BrainContext, GroundingReport };
