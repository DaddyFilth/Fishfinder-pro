import { NextRequest, NextResponse } from 'next/server';
import { analyzeSpotsSmart, type SmartAnalyticsInput, type SmartAnalyticsResult } from '@/lib/aiAnalytics';
import { enforceRateLimit, isSameOrigin, readJsonBody } from '@/lib/security';
import { getAiModel, getGroqClient } from '@/lib/groq';
import { z } from 'zod';

const SmartAnalyticsBodySchema = z.object({
  userLat: z.number().optional().refine((val) => val === undefined || (val >= -90 && val <= 90), {
    message: 'Invalid latitude',
  }),
  userLng: z.number().optional().refine((val) => val === undefined || (val >= -180 && val <= 180), {
    message: 'Invalid longitude',
  }),
  targetSpecies: z.string().trim().max(80).optional(),
conditions: z
    .object({
      waterTempC: z.number().optional(),
      waterTempF: z.number().optional(),
      airTempC: z.number().optional(),
      airTempF: z.number().optional(),
      windSpeedMs: z.number().optional(),
      windSpeedMph: z.number().optional(),
      windDirection: z.string().optional(),
      dissolvedOxygenMgl: z.number().optional(),
      fishingScore: z.number().optional(),
      condition: z.enum(['cool', 'warming', 'stable', 'low-light', 'windy']).optional(),
    })
    .optional().default({}),
  season: z.enum(['Spring', 'Summer', 'Fall', 'Winter']).optional(),
  currentTimeHour: z.number().optional().refine((val) => val === undefined || (val >= 0 && val <= 23), {
    message: 'Invalid hour',
  }),
});

export async function POST(req: NextRequest) {
  const limited = await enforceRateLimit(req, { name: 'ai-smart-analytics', limit: 12, windowMs: 60_000 });
  if (limited) return limited;
  if (!isSameOrigin(req)) {
    return NextResponse.json({ error: 'Cross-site requests are not allowed.' }, { status: 403 });
  }

  const bodyResult = await readJsonBody(req, 32_768);
  if (!bodyResult.ok) return bodyResult.response;
  const body = bodyResult.value;

  const parsed = SmartAnalyticsBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input. Provide userLat, userLng, optional targetSpecies, conditions, season, and currentTimeHour.' },
      { status: 400 },
    );
  }

  const input: SmartAnalyticsInput = {
    userLat: parsed.data.userLat,
    userLng: parsed.data.userLng,
    targetSpecies: parsed.data.targetSpecies,
    conditions: parsed.data.conditions
      ? {
          waterTempC: parsed.data.conditions.waterTempC ?? null,
          waterTempF: parsed.data.conditions.waterTempF ?? null,
          airTempC: parsed.data.conditions.airTempC ?? null,
          airTempF: parsed.data.conditions.airTempF ?? null,
          windSpeedMs: parsed.data.conditions.windSpeedMs ?? null,
          windSpeedMph: parsed.data.conditions.windSpeedMph ?? null,
          windDirection: parsed.data.conditions.windDirection ?? null,
          dissolvedOxygenMgl: parsed.data.conditions.dissolvedOxygenMgl ?? null,
          fishingScore: parsed.data.conditions.fishingScore ?? null,
          condition: parsed.data.conditions.condition ?? 'stable',
        }
      : undefined,
    season: parsed.data.season,
    currentTimeHour: parsed.data.currentTimeHour,
  };

  try {
    const result = await analyzeSpotsSmart(input);

    // If Groq client available, also generate a summary using AI
    let aiSummary: any = null;
    try {
      const groq = getGroqClient();
      const model = getAiModel();

      const topSpot = result.analyzedSpots[0];
      if (topSpot && topSpot.recommendedSpecies?.[0]) {
        const species = topSpot.recommendedSpecies[0];
        const prompt = `You are Fishbot, an AI fishing assistant. Provide a concise 2-sentence summary for an angler about why ${species.name} is the recommended species at ${topSpot.spot.name} today, given conditions: ${topSpot.reason}. Keep it encouraging and concise.`;

        const res = await groq.chat.completions.create({
          model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.5,
          max_tokens: 200,
        });

        aiSummary = res.choices[0]?.message?.content ?? null;
      }
    } catch {
      // AI summary optional; continue without it.
    }

    return NextResponse.json({
      ...result,
      aiSummary,
      source: 'local-catalog',
      data_mode: 'ai-generated',
      live_data: false,
    });
  } catch (error) {
    console.error('Smart analytics error:', error);
    return NextResponse.json(
      { error: 'Smart analytics unavailable.', source: 'none', data_mode: 'unavailable', live_data: false },
      { status: 503 },
    );
  }
}