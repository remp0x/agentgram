import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { getServiceOrderById, getReviewByOrderId, getServiceById, getAgent, updateOrderStatus } from '@/lib/db';
import { getProvider } from '@/lib/providers/registry';

export const maxDuration = 60;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const order = await getServiceOrderById(id);
    if (!order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    const review = order.status === 'completed' ? await getReviewByOrderId(id) : null;

    return NextResponse.json({ success: true, data: { order, review } });
  } catch (error) {
    console.error('Error fetching order:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch order' }, { status: 500 });
  }
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  pay: ['quoted', 'accepted'],
  approve: ['delivered'],
  cancel: ['pending_quote', 'quoted', 'accepted'],
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const body = await request.json();
    const { wallet, action } = body;

    if (!wallet || !action) {
      return NextResponse.json(
        { success: false, error: 'wallet and action are required' },
        { status: 400 },
      );
    }

    const order = await getServiceOrderById(id);
    if (!order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    if (order.client_wallet !== wallet) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const allowedStatuses = VALID_TRANSITIONS[action as string];
    if (!allowedStatuses) {
      return NextResponse.json(
        { success: false, error: `Unknown action: ${action}` },
        { status: 400 },
      );
    }

    if (!allowedStatuses.includes(order.status)) {
      return NextResponse.json(
        { success: false, error: `Cannot ${action} order in status ${order.status}` },
        { status: 400 },
      );
    }

    if (action === 'cancel') {
      const updated = await updateOrderStatus(id, { status: 'cancelled' });
      return NextResponse.json({ success: true, data: updated });
    }

    if (action === 'approve') {
      const updated = await updateOrderStatus(id, { status: 'completed' });
      return NextResponse.json({ success: true, data: updated });
    }

    if (action === 'pay') {
      const { payment_method, escrow_tx_hash } = body;
      if (!escrow_tx_hash) {
        return NextResponse.json(
          { success: false, error: 'escrow_tx_hash required for pay action' },
          { status: 400 },
        );
      }

      await updateOrderStatus(id, {
        status: 'paid',
        payment_method: payment_method || 'usdc-sol',
        escrow_tx_hash,
      });

      const service = await getServiceById(order.service_id);
      if (service?.provider_key && service.provider_model) {
        try {
          await executeOrder(id, order, service);
        } catch (err) {
          console.error(`Auto-execute failed for order ${id}:`, err);
        }
      }

      const updated = await getServiceOrderById(id);
      return NextResponse.json({ success: true, data: updated });
    }

    return NextResponse.json({ success: false, error: 'Unhandled action' }, { status: 400 });
  } catch (error) {
    console.error('Error patching order:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update order' },
      { status: 500 },
    );
  }
}

async function executeOrder(
  orderId: string,
  order: { brief: string; service_id: string; provider_agent_id: string },
  service: { provider_key: string | null; provider_model: string | null },
): Promise<void> {
  await updateOrderStatus(orderId, { status: 'in_progress' });

  const provider = getProvider(service.provider_key!);
  const result = await provider.generate({
    prompt: order.brief,
    model: service.provider_model!,
  });

  const mediaRes = await fetch(result.url);
  if (!mediaRes.ok) {
    throw new Error(`Failed to download generated media: ${mediaRes.status}`);
  }

  const agent = await getAgent(order.provider_agent_id);
  const agentId = agent?.id || order.provider_agent_id;

  const buffer = Buffer.from(await mediaRes.arrayBuffer());
  const ext = result.media_type === 'video' ? 'mp4' : 'png';
  const contentType = result.media_type === 'video' ? 'video/mp4' : 'image/png';
  const blobPath = `atelier/${agentId}/${Date.now()}.${ext}`;

  const blob = await put(blobPath, buffer, { access: 'public', contentType });

  await updateOrderStatus(orderId, {
    status: 'delivered',
    deliverable_url: blob.url,
    deliverable_media_type: result.media_type,
  });
}
