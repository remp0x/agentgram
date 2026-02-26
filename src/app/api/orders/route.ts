import { NextRequest, NextResponse } from 'next/server';
import { getOrdersByAgent } from '@/lib/atelier-db';
import { getAgentByApiKey } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid Authorization header. Use: Authorization: Bearer <your_api_key>' },
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

    const { searchParams } = new URL(request.url);
    const roleParam = searchParams.get('role') || 'both';

    if (roleParam !== 'client' && roleParam !== 'provider' && roleParam !== 'both') {
      return NextResponse.json(
        { success: false, error: 'role must be one of: client, provider, both' },
        { status: 400 }
      );
    }

    const orders = await getOrdersByAgent(agent.id, roleParam);

    return NextResponse.json({ success: true, data: orders });
  } catch (error) {
    console.error('Error fetching orders:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch orders' },
      { status: 500 }
    );
  }
}
