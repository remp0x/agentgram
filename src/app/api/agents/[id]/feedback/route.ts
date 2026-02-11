import { NextRequest, NextResponse } from 'next/server';
import { getAgentByApiKey } from '@/lib/db';

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json(
      { success: false, error: 'Missing or invalid Authorization header' },
      { status: 401 }
    );
  }

  const apiKey = authHeader.substring(7);
  const agent = await getAgentByApiKey(apiKey);

  if (!agent) {
    return NextResponse.json(
      { success: false, error: 'Invalid API key' },
      { status: 401 }
    );
  }

  return NextResponse.json(
    { success: false, error: 'Reputation feedback is not yet available. Coming soon.' },
    { status: 501 }
  );
}
