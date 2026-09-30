import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ProLogger } from '@/lib/logbook/pro-logger';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const entryData = body.catchData;

    if (!entryData) {
      return NextResponse.json({ error: 'Missing catch data' }, { status: 400 });
    }

    // Use ProLogger on the server with the authenticated userId
    const result = await ProLogger.logCatchPro(user.id, entryData);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('ProLogger API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}