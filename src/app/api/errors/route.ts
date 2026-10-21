import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { enforceRateLimit, readJsonBody } from '@/lib/security';

const ErrorSchema = z.object({
  message: z.string().trim().max(2000),
  stack: z.string().max(8000).optional(),
  url: z.string().url().optional(),
  userAgent: z.string().max(512).optional(),
}).strict();

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const limited = await enforceRateLimit(req, { name: 'client-errors', limit: 30, windowMs: 60_000 });
  if (limited) return limited;

  const bodyResult = await readJsonBody(req, 16_384);
  if (!bodyResult.ok) return bodyResult.response;
  const parsed = ErrorSchema.safeParse(bodyResult.value);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid error report.' }, { status: 400 });

  console.error('[client-error]', JSON.stringify(parsed.data));
  return new NextResponse(null, { status: 204 });
}
