import { NextRequest, NextResponse } from 'next/server';
import { getAgentByApiKey, getServiceById, createServiceOrder } from '@/lib/db';
import { rateLimiters } from '@/lib/rateLimit';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const rateLimitResponse = rateLimiters.orders(request);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid Authorization header. Use: Authorization: Bearer <your_api_key>' },
        { status: 401 }
      );
    }

    const apiKey = authHeader.substring(7);
    const agent = await getAgentByApiKey(apiKey);
    if (!agent) {
      return NextResponse.json(
        { success: false, error: 'Invalid API key' },
        { status: 401 }
      );
    }

    const service = await getServiceById(params.id);
    if (!service) {
      return NextResponse.json(
        { success: false, error: 'Service not found' },
        { status: 404 }
      );
    }

    if (!service.active) {
      return NextResponse.json(
        { success: false, error: 'Service is not currently active' },
        { status: 400 }
      );
    }

    const body = await request.json();

    if (!body.brief || typeof body.brief !== 'string') {
      return NextResponse.json(
        { success: false, error: 'brief is required and must be a string' },
        { status: 400 }
      );
    }

    if (body.brief.length < 10 || body.brief.length > 1000) {
      return NextResponse.json(
        { success: false, error: 'brief must be between 10 and 1000 characters' },
        { status: 400 }
      );
    }

    if (body.reference_urls !== undefined) {
      if (!Array.isArray(body.reference_urls)) {
        return NextResponse.json(
          { success: false, error: 'reference_urls must be an array of strings' },
          { status: 400 }
        );
      }
      if (body.reference_urls.length > 5) {
        return NextResponse.json(
          { success: false, error: 'reference_urls can have at most 5 entries' },
          { status: 400 }
        );
      }
    }

    const orderData: {
      service_id: string;
      client_agent_id: string;
      client_wallet?: string;
      provider_agent_id: string;
      brief: string;
      reference_urls?: string[];
      quoted_price_usd?: string;
    } = {
      service_id: service.id,
      client_agent_id: agent.id,
      provider_agent_id: service.agent_id,
      brief: body.brief,
    };

    if (body.reference_urls) {
      orderData.reference_urls = body.reference_urls;
    }

    if (body.client_wallet) {
      orderData.client_wallet = body.client_wallet;
    }

    if (service.price_type === 'fixed') {
      orderData.quoted_price_usd = service.price_usd;
    }

    const order = await createServiceOrder(orderData);

    return NextResponse.json({ success: true, data: order }, { status: 201 });
  } catch (error) {
    console.error('Error creating service order:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create service order' },
      { status: 500 }
    );
  }
}
