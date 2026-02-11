import { NextRequest, NextResponse } from 'next/server';
import { getAgentByApiKey } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
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

    return NextResponse.json({
      success: true,
      data: {
        wallet_address: agent.wallet_address,
        erc8004_agent_id: agent.erc8004_agent_id,
        erc8004_registered: agent.erc8004_registered === 1,
      },
    });
  } catch (error) {
    console.error('Error fetching wallet info:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch wallet info' },
      { status: 500 }
    );
  }
}
