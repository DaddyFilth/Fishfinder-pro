import { getAiModel, getAiProviderName, getAiVisionModel, getGroqClient, type AiProvider } from '@/lib/groq';
import { FISHBOT_SYSTEM_PROMPT } from '@/lib/fishbotPrompt';
import {
  buildGroundingBlocks,
  buildGroundingReport,
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
  /** The model's reply text (trimmed). Empty string when the provider returned nothing. */
  text: string;
  provider: AiProvider;
  model: string;
  grounding: GroundingReport;
}

/**
 * The single server-side brain. Every AI call in the app routes through here so
 * they share one provider, one model policy, and one grounding contract.
 *
 * `callFishbot` is the low-level provider gate used by task-specific routes that
 * build their own prompt/schema; `askBrain` is the grounded conversational entry
 * point used by the per-spot and global chats.
 */
export async function callFishbot(params: BrainParams): Promise<BrainProviderResult> {
  const client = getGroqClient();
  const response = await client.chat.completions.create({
    model: params.model ?? getAiModel(),
    messages: params.messages,
    ...(params.temperature !== undefined && { temperature: params.temperature }),
    ...(params.max_tokens !== undefined && { max_tokens: params.max_tokens }),
    ...(params.top_p !== undefined && { top_p: params.top_p }),
    ...(params.response_format !== undefined && { response_format: params.response_format }),
    stream: false,
  });
  return {
    choices: response.choices.map((choice) => ({
      message: { content: choice.message.content },
    })),
  };
}

/**
 * Low-level provider call that returns the model's text (or throws when empty).
 * Task-specific routes should prefer this over reaching into the provider so
 * the brain stays the only place that talks to an LLM.
 */
export async function runBrainPrompt(params: BrainParams): Promise<string> {
  const response = await callFishbot(params);
  const content = response.choices[0]?.message?.content?.trim();
  if (!content) throw new Error('AI provider returned no text');
  return content;
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
  const model = options.model ?? getAiModel();

  const response = await callFishbot({
    messages,
    model,
    temperature: options.temperature ?? 0.6,
    max_tokens: options.maxTokens ?? 900,
    ...(options.topP !== undefined && { top_p: options.topP }),
    ...(options.responseFormat !== undefined && { response_format: options.responseFormat }),
  });

  const text = response.choices[0]?.message?.content?.trim() ?? '';
  if (!text) throw new Error('AI provider returned no text');

  return {
    text,
    provider: getAiProviderName(),
    model,
    grounding: buildGroundingReport(context),
  };
}

/** Grounded call that asks the provider for a JSON object (the caller parses it). */
export function askBrainJson(
  question: string,
  context: BrainContext = {},
  options: BrainOptions = {},
): Promise<BrainResult> {
  return askBrain(question, context, { ...options, responseFormat: { type: 'json_object' } });
}

/** Vision variant for photo identification. */
export async function askBrainVision(
  question: string,
  imageDataUrl: string,
  options: BrainOptions = {},
): Promise<BrainResult> {
  const model = options.model ?? getAiVisionModel();
  const response = await callFishbot({
    model,
    max_tokens: options.maxTokens ?? 600,
    ...(options.temperature !== undefined && { temperature: options.temperature }),
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: question },
          { type: 'image_url', image_url: { url: imageDataUrl } },
        ],
      },
    ],
  });

  const text = response.choices[0]?.message?.content?.trim() ?? '';
  if (!text) throw new Error('AI provider returned no vision text');

  return {
    text,
    provider: getAiProviderName(),
    model,
    grounding: buildGroundingReport({}),
  };
}

export { getAiModel, getAiProviderName, getAiVisionModel };
export type { AiProvider, BrainContext, GroundingReport };
