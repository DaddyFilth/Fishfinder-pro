import { NextRequest, NextResponse } from 'next/server';
import { getOllama, OLLAMA_MODEL } from '@/lib/ollama';
import { temperatureFahrenheitValue } from '@/lib/temperature';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function convertConditionTemperaturesToFahrenheit(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return value;
  }

  const result: Record<string, unknown> = {};

  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (key.endsWith('_temp_c') && typeof item === 'number') {
      const fahrenheitKey = key.slice(0, -2) + 'f';
      result[fahrenheitKey] = temperatureFahrenheitValue(item);
      continue;
    }

    result[key] = item;
  }

  return result;
}
export async function POST(req: NextRequest) {
  let body: {
    message?: unknown;
    history?: unknown;
    spot?: unknown;
    conditions?: unknown;
    solunar?: unknown;
    species?: unknown;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'FishBot received an invalid request.' },
      { status: 400 },
    );
  }

  if (typeof body.message !== 'string' || !body.message.trim()) {
    return NextResponse.json(
      { error: 'Enter a question for FishBot.' },
      { status: 400 },
    );
  }

  const spot = asRecord(body.spot);
  const spotName = typeof spot.name === 'string' ? spot.name : 'the selected fishing spot';
  const waterType = typeof spot.water_type === 'string' ? spot.water_type : 'public water';
  const spotType = typeof spot.spot_type === 'string' ? spot.spot_type : 'fishing access';

  const history: ChatMessage[] = Array.isArray(body.history)
    ? body.history
        .filter((item): item is Record<string, unknown> =>
          Boolean(item) && typeof item === 'object',
        )
        .filter(
          (item): item is Record<string, unknown> & {
            role: 'user' | 'assistant';
            content: string;
          } =>
            (item.role === 'user' || item.role === 'assistant') &&
            typeof item.content === 'string' &&
            item.content.trim().length > 0,
        )
        .slice(-12)
        .map((item) => ({
          role: item.role,
          content: item.content.trim(),
        }))
    : [];

  const systemPrompt = [
    'You are FishBot, a knowledgeable and conversational Oklahoma fishing guide.',
    'Hold a natural back-and-forth conversation. Use the earlier messages to answer follow-up questions.',
    'Give practical, specific advice: target species, depth, structure, lure or bait, retrieve, time window, and adjustments for conditions when relevant.',
    'Be honest about uncertainty. Do not fabricate live readings, catches, regulations, or access conditions.',
    'Keep answers useful and conversational, normally 2–5 short paragraphs or bullet points when steps are helpful.',
'Temperature rule: use Fahrenheit only. Never show Celsius, never use °C, and never describe a Celsius value to the user.',
    `Current selected spot: ${spotName}.`,
    `Water type: ${waterType}. Access/type: ${spotType}.`,
    `Conditions supplied by the app in Fahrenheit: ${JSON.stringify(convertConditionTemperaturesToFahrenheit(body.conditions || {}))}.`,
    `Solunar information supplied by the app: ${JSON.stringify(body.solunar || {})}.`,
    `Target species supplied by the app: ${typeof body.species === 'string' ? body.species : 'not specified'}.`,
  ].join(String.fromCharCode(10));

  try {
    const client = getOllama();

    const response = await client.chat.completions.create({
      model: OLLAMA_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        ...history,
        { role: 'user', content: body.message.trim() },
      ],
      temperature: 0.75,
      max_tokens: 700,
    });

    const reply = response.choices[0]?.message?.content?.trim();

    if (!reply) {
      return NextResponse.json(
        { error: 'Groq returned an empty FishBot reply. Please try again.' },
        { status: 502 },
      );
    }

    return NextResponse.json({ reply, provider: 'groq' });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown AI provider error';

    console.error('[FishBot /api/ai/chat]', message);

    return NextResponse.json(
      {
        error: `FishBot could not reach Groq: ${message}`,
        provider: 'unavailable',
      },
      { status: 502 },
    );
  }
}
