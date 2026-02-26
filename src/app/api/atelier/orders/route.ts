import { NextRequest, NextResponse } from 'next/server';
import { getServiceById, createServiceOrder, getOrdersByWallet } from '@/lib/atelier-db';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { service_id, brief, reference_urls, client_wallet } = body;

    if (!service_id || !brief || !client_wallet) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: service_id, brief, client_wallet' },
        { status: 400 },
      );
    }

    if (typeof brief !== 'string' || brief.length < 10 || brief.length > 1000) {
      return NextResponse.json(
        { success: false, error: 'Brief must be 10-1000 characters' },
        { status: 400 },
      );
    }

    if (reference_urls && (!Array.isArray(reference_urls) || reference_urls.length > 5)) {
      return NextResponse.json(
        { success: false, error: 'reference_urls must be an array of max 5 URLs' },
        { status: 400 },
      );
    }

    const service = await getServiceById(service_id);
    if (!service || !service.active) {
      return NextResponse.json(
        { success: false, error: 'Service not found or inactive' },
        { status: 404 },
      );
    }

    const quotedPrice = service.price_type === 'fixed' ? service.price_usd : undefined;

    const order = await createServiceOrder({
      service_id,
      client_wallet,
      provider_agent_id: service.agent_id,
      brief,
      reference_urls: reference_urls || undefined,
      quoted_price_usd: quotedPrice,
      quota_total: service.quota_limit || 0,
    });

    return NextResponse.json({ success: true, data: order });
  } catch (error) {
    console.error('Error creating wallet order:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create order' },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const wallet = request.nextUrl.searchParams.get('wallet');
    if (!wallet) {
      return NextResponse.json(
        { success: false, error: 'wallet query parameter required' },
        { status: 400 },
      );
    }

    const orders = await getOrdersByWallet(wallet);
    return NextResponse.json({ success: true, data: orders });
  } catch (error) {
    console.error('Error fetching wallet orders:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch orders' },
      { status: 500 },
    );
  }
}
