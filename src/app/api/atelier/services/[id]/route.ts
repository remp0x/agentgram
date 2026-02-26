import { NextRequest, NextResponse } from 'next/server';
import { getServiceById, updateService, deactivateService, type ServiceCategory, type ServicePriceType } from '@/lib/atelier-db';
import { resolveExternalAgentByApiKey, AuthError } from '@/lib/atelier-auth';

const VALID_CATEGORIES: ServiceCategory[] = ['image_gen', 'video_gen', 'ugc', 'influencer', 'brand_content', 'custom'];
const VALID_PRICE_TYPES: ServicePriceType[] = ['fixed', 'quote'];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: serviceId } = await params;
    const agent = await resolveExternalAgentByApiKey(request);

    const service = await getServiceById(serviceId);
    if (!service) {
      return NextResponse.json({ success: false, error: 'Service not found' }, { status: 404 });
    }

    if (service.agent_id !== agent.id) {
      return NextResponse.json({ success: false, error: 'Service does not belong to this agent' }, { status: 403 });
    }

    return NextResponse.json({ success: true, data: service });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    console.error('GET /api/atelier/services/[id] error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: serviceId } = await params;
    const agent = await resolveExternalAgentByApiKey(request);

    const existing = await getServiceById(serviceId);
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Service not found' }, { status: 404 });
    }
    if (existing.agent_id !== agent.id) {
      return NextResponse.json({ success: false, error: 'Service does not belong to this agent' }, { status: 403 });
    }

    const body = await request.json();
    const { category, title, description, price_usd, price_type, turnaround_hours, deliverables, demo_url } = body;

    if (category !== undefined && !VALID_CATEGORIES.includes(category)) {
      return NextResponse.json(
        { success: false, error: `Invalid category. Valid: ${VALID_CATEGORIES.join(', ')}` },
        { status: 400 }
      );
    }

    if (title !== undefined && (typeof title !== 'string' || title.length < 3 || title.length > 100)) {
      return NextResponse.json({ success: false, error: 'title must be between 3 and 100 characters' }, { status: 400 });
    }

    if (description !== undefined && (typeof description !== 'string' || description.length < 10 || description.length > 1000)) {
      return NextResponse.json({ success: false, error: 'description must be between 10 and 1000 characters' }, { status: 400 });
    }

    if (price_usd !== undefined && (isNaN(parseFloat(price_usd)) || parseFloat(price_usd) < 0)) {
      return NextResponse.json({ success: false, error: 'price_usd must be a valid non-negative number' }, { status: 400 });
    }

    if (price_type !== undefined && !VALID_PRICE_TYPES.includes(price_type)) {
      return NextResponse.json({ success: false, error: `price_type must be one of: ${VALID_PRICE_TYPES.join(', ')}` }, { status: 400 });
    }

    if (demo_url !== undefined && demo_url !== null) {
      try { new URL(demo_url); } catch {
        return NextResponse.json({ success: false, error: 'demo_url must be a valid URL' }, { status: 400 });
      }
    }

    const updates: Record<string, string | number | null | undefined> = {};
    if (category !== undefined) updates.category = category;
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (price_usd !== undefined) updates.price_usd = String(price_usd);
    if (price_type !== undefined) updates.price_type = price_type;
    if (turnaround_hours !== undefined) updates.turnaround_hours = Number(turnaround_hours);
    if (deliverables !== undefined) updates.deliverables = JSON.stringify(deliverables);
    if (demo_url !== undefined) updates.demo_url = demo_url;

    const updated = await updateService(serviceId, agent.id, updates);
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    console.error('PATCH /api/atelier/services/[id] error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: serviceId } = await params;
    const agent = await resolveExternalAgentByApiKey(request);

    const existing = await getServiceById(serviceId);
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Service not found' }, { status: 404 });
    }
    if (existing.agent_id !== agent.id) {
      return NextResponse.json({ success: false, error: 'Service does not belong to this agent' }, { status: 403 });
    }

    const deactivated = await deactivateService(serviceId, agent.id);
    if (!deactivated) {
      return NextResponse.json({ success: false, error: 'Failed to deactivate service' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: { id: serviceId, active: 0 } });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    console.error('DELETE /api/atelier/services/[id] error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
