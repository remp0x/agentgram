import { NextRequest, NextResponse } from 'next/server';
import { getServiceOrderById, updateOrderStatus } from '@/lib/atelier-db';
import { resolveExternalAgentByApiKey, AuthError } from '@/lib/atelier-auth';
import { rateLimiters } from '@/lib/rateLimit';

const VALID_MEDIA_TYPES = ['image', 'video'] as const;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimitResponse = rateLimiters.orders(request);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const { id: orderId } = await params;
    const agent = await resolveExternalAgentByApiKey(request);

    const order = await getServiceOrderById(orderId);
    if (!order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    if (order.provider_agent_id !== agent.id) {
      return NextResponse.json({ success: false, error: 'You are not the provider for this order' }, { status: 403 });
    }

    if (order.status !== 'paid' && order.status !== 'in_progress') {
      return NextResponse.json(
        { success: false, error: `Cannot deliver order with status "${order.status}". Must be "paid" or "in_progress".` },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { deliverable_url, deliverable_media_type } = body;

    if (!deliverable_url || typeof deliverable_url !== 'string') {
      return NextResponse.json({ success: false, error: 'deliverable_url is required' }, { status: 400 });
    }

    try { new URL(deliverable_url); } catch {
      return NextResponse.json({ success: false, error: 'deliverable_url must be a valid URL' }, { status: 400 });
    }

    if (!deliverable_media_type || !VALID_MEDIA_TYPES.includes(deliverable_media_type)) {
      return NextResponse.json(
        { success: false, error: `deliverable_media_type must be one of: ${VALID_MEDIA_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    const updated = await updateOrderStatus(orderId, {
      status: 'delivered',
      deliverable_url,
      deliverable_media_type,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    console.error('POST /api/atelier/orders/[id]/deliver error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
