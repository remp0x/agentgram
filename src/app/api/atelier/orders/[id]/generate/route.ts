import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import {
  getServiceOrderById,
  getServiceById,
  getAgent,
  updateOrderStatus,
  createOrderDeliverable,
  updateOrderDeliverable,
  incrementOrderQuotaUsed,
} from '@/lib/db';
import { getProvider } from '@/lib/providers/registry';
import { generateWithRetry } from '@/lib/providers/types';

export const maxDuration = 300;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id: orderId } = await params;

  try {
    const body = await request.json();
    const { wallet, prompt } = body;

    if (!wallet || !prompt || typeof prompt !== 'string' || prompt.length < 1) {
      return NextResponse.json(
        { success: false, error: 'wallet and prompt are required' },
        { status: 400 },
      );
    }

    const order = await getServiceOrderById(orderId);
    if (!order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    if (order.client_wallet !== wallet) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    if (order.quota_total <= 0) {
      return NextResponse.json({ success: false, error: 'Not a workspace order' }, { status: 400 });
    }

    if (order.status !== 'in_progress') {
      return NextResponse.json(
        { success: false, error: `Order is ${order.status}, not in_progress` },
        { status: 400 },
      );
    }

    if (order.workspace_expires_at && new Date(order.workspace_expires_at) <= new Date()) {
      await updateOrderStatus(orderId, { status: 'delivered' });
      return NextResponse.json(
        { success: false, error: 'Workspace session has expired' },
        { status: 400 },
      );
    }

    if (order.quota_used >= order.quota_total) {
      await updateOrderStatus(orderId, { status: 'delivered' });
      return NextResponse.json(
        { success: false, error: 'Quota exhausted' },
        { status: 400 },
      );
    }

    const service = await getServiceById(order.service_id);
    if (!service?.provider_key || !service.provider_model) {
      return NextResponse.json(
        { success: false, error: 'Service provider not configured' },
        { status: 500 },
      );
    }

    const deliverable = await createOrderDeliverable(orderId, prompt);

    try {
      await updateOrderDeliverable(deliverable.id, { status: 'generating' });

      const fullPrompt = service.system_prompt
        ? `${service.system_prompt}\n\nUser request: ${prompt}`
        : prompt;

      const provider = getProvider(service.provider_key);
      const result = await generateWithRetry(provider, {
        prompt: fullPrompt,
        model: service.provider_model,
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

      await updateOrderDeliverable(deliverable.id, {
        status: 'completed',
        deliverable_url: blob.url,
        deliverable_media_type: result.media_type,
      });

      await incrementOrderQuotaUsed(orderId);

      const refreshedOrder = await getServiceOrderById(orderId);
      if (refreshedOrder && refreshedOrder.quota_used >= refreshedOrder.quota_total) {
        await updateOrderStatus(orderId, { status: 'delivered' });
      }

      return NextResponse.json({
        success: true,
        data: {
          deliverable: {
            ...deliverable,
            status: 'completed',
            deliverable_url: blob.url,
            deliverable_media_type: result.media_type,
          },
          quota_used: refreshedOrder?.quota_used ?? order.quota_used + 1,
          quota_total: order.quota_total,
        },
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Generation failed';
      await updateOrderDeliverable(deliverable.id, { status: 'failed', error: errorMsg });

      return NextResponse.json(
        {
          success: false,
          error: errorMsg,
          data: {
            deliverable: { ...deliverable, status: 'failed', error: errorMsg },
          },
        },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error('Error in workspace generate:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate' },
      { status: 500 },
    );
  }
}
