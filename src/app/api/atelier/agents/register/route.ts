import { NextRequest, NextResponse } from 'next/server';
import { registerAtelierAgent, type ServiceCategory } from '@/lib/atelier-db';
import { rateLimiters } from '@/lib/rateLimit';

const VALID_CAPABILITIES: ServiceCategory[] = ['image_gen', 'video_gen', 'ugc', 'influencer', 'brand_content', 'custom'];

const BASE58_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

const PROTOCOL_SPEC = {
  required_endpoints: [
    'GET  /agent/profile    → { name, description, avatar_url, capabilities[] }',
    'GET  /agent/services   → { services: [{ id, title, description, price_usd, category }] }',
    'POST /agent/execute    → { service_id, brief, params } → { result, deliverable_url }',
    'GET  /agent/portfolio  → { works: [{ url, type, caption, created_at }] }',
  ],
};

export async function POST(request: NextRequest) {
  const rateLimitResponse = rateLimiters.registration(request);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const body = await request.json();
    const { name, description, avatar_url, endpoint_url, capabilities, owner_wallet } = body;

    if (!name || !description || !endpoint_url) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: name, description, endpoint_url' },
        { status: 400 }
      );
    }

    if (name.length < 2 || name.length > 50) {
      return NextResponse.json(
        { success: false, error: 'Name must be between 2 and 50 characters' },
        { status: 400 }
      );
    }

    if (description.length < 10 || description.length > 500) {
      return NextResponse.json(
        { success: false, error: 'Description must be between 10 and 500 characters' },
        { status: 400 }
      );
    }

    try {
      new URL(endpoint_url);
    } catch {
      return NextResponse.json(
        { success: false, error: 'endpoint_url must be a valid URL' },
        { status: 400 }
      );
    }

    if (owner_wallet && !BASE58_REGEX.test(owner_wallet)) {
      return NextResponse.json(
        { success: false, error: 'owner_wallet must be a valid base58 Solana address' },
        { status: 400 }
      );
    }

    if (capabilities && Array.isArray(capabilities)) {
      const invalid = capabilities.filter((c: string) => !VALID_CAPABILITIES.includes(c as ServiceCategory));
      if (invalid.length > 0) {
        return NextResponse.json(
          { success: false, error: `Invalid capabilities: ${invalid.join(', ')}. Valid: ${VALID_CAPABILITIES.join(', ')}` },
          { status: 400 }
        );
      }
    }

    const result = await registerAtelierAgent({
      name,
      description,
      avatar_url,
      endpoint_url,
      capabilities: capabilities || [],
      owner_wallet: owner_wallet || undefined,
    });

    return NextResponse.json({
      success: true,
      data: {
        agent_id: result.agent_id,
        api_key: result.api_key,
        protocol_spec: PROTOCOL_SPEC,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Atelier agent registration error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
