import { NextRequest, NextResponse } from 'next/server';
import { getOllama, OLLAMA_MODEL } from '@/lib/ollama';
import { temperatureFahrenheitValue } from '@/lib/temperature';
import { enforceRateLimit, requestBodyTooLarge, tooLarge } from '@/lib/security';

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
  const limited = enforceRateLimit(req, { name: 'ai-chat', limit: 20, windowMs: 60_000 });
  if (limited) return limited;
  if (requestBodyTooLarge(req)) return tooLarge();

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

  // Cap input lengths to prevent prompt injection via oversized payloads.
  const message = body.message.trim().slice(0, 2000);
  const speciesInput =
    typeof body.species === 'string' ? body.species.slice(0, 100) : undefined;

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
    'You are FishBot, the helpful in-app assistant for Oklahoma Fishfinder Pro.',
    'You can provide fishing guidance, explain how to use this app, and guide a signed-in user through creating a private trip-log draft.',
    'Hold a natural back-and-forth conversation. Use earlier messages to answer follow-up questions.',
    'For fishing advice, give practical, specific recommendations: species, depth, structure, lure or bait, retrieve, timing, and condition-based adjustments when relevant.',
    'For app-help questions, explain only real app features: Map markers and popups, Top Spots, Settings filters and layers, GPS nearby mode, Logbook, Gallery, Species, Bite Time, Weather, directions, and offline saved spot data. Give concise numbered steps when useful. Do not invent screens, buttons, subscriptions, or features.',
    'When the user asks to log, save, record, add, or create a trip, start a guided trip-log draft. Extract details the user already supplied. Ask only one short question at a time for the most important missing field.',
    'Trip draft fields are: title, water body, date, species, catch count, weather, and notes. Required before a save review: title, water body, and date. Species, catch count, weather, and notes are optional.',
    'If the date is missing, ask for it; do not silently assume today. If catch count is missing, ask whether they want to record a catch count. Never ask for location unless the user specifically wants location attached.',
    'When title, water body, and date are known, show a compact review listing every known field, then ask exactly: Save this trip to your private logbook?',
    'Never claim a trip was saved. Never state that you saved, created, or modified a record. Saving happens only after the app asks for explicit confirmation and the server confirms success.',
    'If the user says cancel, say the draft was discarded and do not continue the save flow.',
    'Be honest about uncertainty. Do not fabricate live readings, catches, regulations, access conditions, app state, or draft values.',
    'Keep answers useful and conversational, normally 2–5 short paragraphs or short bullets when steps are helpful.',
    'For community spot submissions: never invent a location name, coordinates, public-access status, agency, source URL, or access details. Ask the user for a map-selected location or exact coordinates and their factual access information. Explain that only approved submissions become public. Do not claim a location is public, legal, open, verified, or approved unless the app supplies that status.',
    'Temperature rule: use Fahrenheit only. Never show Celsius, never use °C, and never describe a Celsius value to the user.',
    `Current selected spot: ${spotName}.`,
    `Water type: ${waterType}. Access/type: ${spotType}.`,
    `Conditions supplied by the app in Fahrenheit: ${JSON.stringify(convertConditionTemperaturesToFahrenheit(body.conditions || {}))}.`,
    `Solunar information supplied by the app: ${JSON.stringify(body.solunar || {})}.`,
    `Target species supplied by the app: ${speciesInput ?? 'not specified'}.`,
  ].join(String.fromCharCode(10));

  try {
    const client = getOllama();

    const response = await client.chat.completions.create({
      model: OLLAMA_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        ...history,
        { role: 'user', content: message },
      ],
      temperature: 0.75,
      max_tokens: 700,
    });

    const reply = response.choices[0]?.message?.content?.trim();

    if (!reply) {
      return NextResponse.json(
        { error: 'FishBot received an empty reply from the AI provider. Please try again.' },
        { status: 502 },
      );
    }

    return NextResponse.json({ reply, provider: 'ollama' });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown AI provider error';

    console.error('[FishBot /api/ai/chat]', message);

    return NextResponse.json(
      {
        error: `FishBot could not reach the AI provider. Please try again later.`,
        provider: 'unavailable',
      },
      { status: 502 },
    );
  }
}
