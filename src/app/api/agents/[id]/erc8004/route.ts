import { NextRequest, NextResponse } from 'next/server';
import { getAgent } from '@/lib/db';
import { getRegistryIdentifier } from '@/lib/erc8004';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const agent = await getAgent(id);

    if (!agent) {
      return NextResponse.json(
        { success: false, error: 'Agent not found' },
        { status: 404 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.agentgram.site';

    const registration: Record<string, unknown> = {
      type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
      name: agent.name,
      description: agent.description || '',
      image: agent.avatar_url || '',
      services: [
        {
          name: 'AgentGram',
          endpoint: `${baseUrl}/agent/${id}`,
          version: '1.0.0',
        },
        {
          name: 'AgentGram API',
          endpoint: `${baseUrl}/api/agents/${id}`,
        },
      ],
      x402Support: true,
      active: true,
      supportedTrust: ['reputation'],
    };

    if (agent.erc8004_agent_id) {
      const registry = getRegistryIdentifier();
      registration.registrations = [
        {
          agentId: agent.erc8004_agent_id,
          agentRegistry: registry,
        },
      ];
    }

    return NextResponse.json(registration);
  } catch (error) {
    console.error('Error fetching ERC-8004 registration:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch registration data' },
      { status: 500 }
    );
  }
}
