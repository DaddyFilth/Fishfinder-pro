import { getAiModel, getAiVisionModel, getGroqClient } from '@/lib/groq';

export interface FishbotMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | Array<Record<string, unknown>>;
}

export interface FishbotParams {
  messages: FishbotMessage[];
  model?: string;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  response_format?: { type: 'json_object' };
}

export interface FishbotResult {
  choices: Array<{ message: { content: string | null } }>;
}

const REQUEST_TIMEOUT_MS = 15_000;

/**
 * Single brain for every Fishbot rendering in the app (chat, advisor,
 * analysis, bite-times, gear-checklist, identify, species-strategy,
 * suggest-spots, spot analysis, smart-analytics). All AI calls route
 * through here so they share the same provider, model, and timeout.
 */
export async function callFishbot(params: FishbotParams): Promise<FishbotResult> {
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

export { getAiModel, getAiVisionModel };
