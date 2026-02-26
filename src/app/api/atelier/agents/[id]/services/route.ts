import { NextRequest, NextResponse } from 'next/server';
import { createService, getServicesByAgent, type ServiceCategory, type ServicePriceType } from '@/lib/atelier-db';
import { resolveExternalAgentByApiKey, AuthError } from '@/lib/atelier-auth';
import { rateLimiters } from '@/lib/rateLimit';

const VALID_CATEGORIES: ServiceCategory[] = ['image_gen', 'video_gen', 'ugc', 'influencer', 'brand_content', 'custom'];
const VALID_PRICE_TYPES: ServicePriceType[] = ['fixed', 'quote'];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params;
    const agent = await resolveExternalAgentByApiKey(request);

    if (agent.id !== agentId) {
      return NextResponse.json({ success: false, error: 'Agent ID mismatch' }, { status: 403 });
    }

    const services = await getServicesByAgent(agentId);
    return NextResponse.json({ success: true, data: services });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    console.error('GET /api/atelier/agents/[id]/services error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimitResponse = rateLimiters.services(request);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const { id: agentId } = await params;
    const agent = await resolveExternalAgentByApiKey(request);

    if (agent.id !== agentId) {
      return NextResponse.json({ success: false, error: 'Agent ID mismatch' }, { status: 403 });
    }

    const body = await request.json();
    const { category, title, description, price_usd, price_type, turnaround_hours, deliverables, demo_url } = body;

    if (!category || !VALID_CATEGORIES.includes(category)) {
      return NextResponse.json(
        { success: false, error: `category is required. Valid: ${VALID_CATEGORIES.join(', ')}` },
        { status: 400 }
      );
    }

    if (!title || typeof title !== 'string' || title.length < 3 || title.length > 100) {
      return NextResponse.json({ success: false, error: 'title must be between 3 and 100 characters' }, { status: 400 });
    }

    if (!description || typeof description !== 'string' || description.length < 10 || description.length > 1000) {
      return NextResponse.json({ success: false, error: 'description must be between 10 and 1000 characters' }, { status: 400 });
    }

    if (!price_usd || isNaN(parseFloat(price_usd)) || parseFloat(price_usd) < 0) {
      return NextResponse.json({ success: false, error: 'price_usd must be a valid non-negative number' }, { status: 400 });
    }

    if (!price_type || !VALID_PRICE_TYPES.includes(price_type)) {
      return NextResponse.json({ success: false, error: `price_type must be one of: ${VALID_PRICE_TYPES.join(', ')}` }, { status: 400 });
    }

    if (demo_url) {
      try { new URL(demo_url); } catch {
        return NextResponse.json({ success: false, error: 'demo_url must be a valid URL' }, { status: 400 });
      }
    }

    const service = await createService({
      agent_id: agent.id,
      category,
      title,
      description,
      price_usd: String(price_usd),
      price_type,
      turnaround_hours: turnaround_hours ? Number(turnaround_hours) : undefined,
      deliverables: deliverables || [],
      demo_url: demo_url || undefined,
    });

    return NextResponse.json({ success: true, data: service }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    console.error('POST /api/atelier/agents/[id]/services error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
