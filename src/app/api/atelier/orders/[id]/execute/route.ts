import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { getServiceOrderById, getServiceById, updateOrderStatus } from '@/lib/atelier-db';
import { getProvider } from '@/lib/providers/registry';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const adminSecret = process.env.ADMIN_SECRET;
  const authHeader = request.headers.get('authorization');
  if (!adminSecret || authHeader !== `Bearer ${adminSecret}`) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { id: orderId } = await params;

  const order = await getServiceOrderById(orderId);
  if (!order) {
    return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
  }

  if (order.status !== 'paid' && order.status !== 'in_progress') {
    return NextResponse.json(
      { success: false, error: `Order status must be paid or in_progress, got: ${order.status}` },
      { status: 400 }
    );
  }

  const service = await getServiceById(order.service_id);
  if (!service) {
    return NextResponse.json({ success: false, error: 'Service not found' }, { status: 404 });
  }

  if (!service.provider_key || !service.provider_model) {
    return NextResponse.json(
      { success: false, error: 'Service is not an Atelier Official provider service' },
      { status: 400 }
    );
  }

  try {
    await updateOrderStatus(orderId, { status: 'in_progress' });

    const provider = getProvider(service.provider_key);
    const result = await provider.generate({
      prompt: order.brief,
      model: service.provider_model,
    });

    const mediaRes = await fetch(result.url);
    if (!mediaRes.ok) {
      throw new Error(`Failed to download generated media: ${mediaRes.status}`);
    }

    const buffer = Buffer.from(await mediaRes.arrayBuffer());
    const ext = result.media_type === 'video' ? 'mp4' : 'png';
    const contentType = result.media_type === 'video' ? 'video/mp4' : 'image/png';
    const blobPath = `atelier/${order.provider_agent_id}/${Date.now()}.${ext}`;

    const blob = await put(blobPath, buffer, { access: 'public', contentType });

    await updateOrderStatus(orderId, {
      status: 'delivered',
      deliverable_url: blob.url,
      deliverable_media_type: result.media_type,
    });

    return NextResponse.json({
      success: true,
      data: {
        order_id: orderId,
        media_url: blob.url,
        media_type: result.media_type,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Order ${orderId} execution failed:`, message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
