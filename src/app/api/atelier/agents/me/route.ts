import { NextRequest, NextResponse } from 'next/server';
import { updateAtelierAgent, type ServiceCategory } from '@/lib/atelier-db';
import { resolveExternalAgentByApiKey, AuthError } from '@/lib/atelier-auth';

const VALID_CAPABILITIES: ServiceCategory[] = ['image_gen', 'video_gen', 'ugc', 'influencer', 'brand_content', 'custom'];
const BASE58_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export async function GET(request: NextRequest) {
  try {
    const agent = await resolveExternalAgentByApiKey(request);

    const maskedKey = agent.api_key ? `atelier_...${agent.api_key.slice(-4)}` : '—';

    return NextResponse.json({
      success: true,
      data: {
        id: agent.id,
        name: agent.name,
        description: agent.description,
        avatar_url: agent.avatar_url,
        endpoint_url: agent.endpoint_url,
        capabilities: agent.capabilities,
        api_key: maskedKey,
        verified: agent.verified,
        total_orders: agent.total_orders,
        completed_orders: agent.completed_orders,
        avg_rating: agent.avg_rating,
        owner_wallet: agent.owner_wallet,
        payout_wallet: agent.payout_wallet,
        created_at: agent.created_at,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    console.error('GET /api/atelier/agents/me error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const agent = await resolveExternalAgentByApiKey(request);
    const body = await request.json();
    const { name, description, avatar_url, endpoint_url, capabilities, payout_wallet } = body;

    if (name !== undefined) {
      if (typeof name !== 'string' || name.length < 2 || name.length > 50) {
        return NextResponse.json({ success: false, error: 'Name must be between 2 and 50 characters' }, { status: 400 });
      }
    }

    if (description !== undefined) {
      if (typeof description !== 'string' || description.length < 10 || description.length > 500) {
        return NextResponse.json({ success: false, error: 'Description must be between 10 and 500 characters' }, { status: 400 });
      }
    }

    if (avatar_url !== undefined && avatar_url !== null) {
      try { new URL(avatar_url); } catch {
        return NextResponse.json({ success: false, error: 'avatar_url must be a valid URL' }, { status: 400 });
      }
    }

    if (endpoint_url !== undefined) {
      try { new URL(endpoint_url); } catch {
        return NextResponse.json({ success: false, error: 'endpoint_url must be a valid URL' }, { status: 400 });
      }
    }

    if (capabilities !== undefined) {
      if (!Array.isArray(capabilities)) {
        return NextResponse.json({ success: false, error: 'capabilities must be an array' }, { status: 400 });
      }
      const invalid = capabilities.filter((c: string) => !VALID_CAPABILITIES.includes(c as ServiceCategory));
      if (invalid.length > 0) {
        return NextResponse.json(
          { success: false, error: `Invalid capabilities: ${invalid.join(', ')}. Valid: ${VALID_CAPABILITIES.join(', ')}` },
          { status: 400 }
        );
      }
    }

    if (payout_wallet !== undefined && payout_wallet !== null) {
      if (typeof payout_wallet !== 'string' || !BASE58_REGEX.test(payout_wallet)) {
        return NextResponse.json(
          { success: false, error: 'payout_wallet must be a valid base58 Solana address' },
          { status: 400 },
        );
      }
    }

    const updates: Record<string, string | null> = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (avatar_url !== undefined) updates.avatar_url = avatar_url;
    if (endpoint_url !== undefined) updates.endpoint_url = endpoint_url;
    if (capabilities !== undefined) updates.capabilities = JSON.stringify(capabilities);
    if (payout_wallet !== undefined) updates.payout_wallet = payout_wallet;

    const updated = await updateAtelierAgent(agent.id, updates);
    if (!updated) {
      return NextResponse.json({ success: false, error: 'Agent not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    console.error('PATCH /api/atelier/agents/me error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
