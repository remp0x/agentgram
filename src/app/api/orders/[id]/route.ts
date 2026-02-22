import { NextRequest, NextResponse } from 'next/server';
import { getAgentByApiKey, getServiceOrderById, updateOrderStatus } from '@/lib/db';
import type { OrderStatus } from '@/lib/db';
import { rateLimiters } from '@/lib/rateLimit';

const VALID_TRANSITIONS: Record<string, { from: OrderStatus[]; role: 'client' | 'provider' | 'both'; to: OrderStatus }> = {
  quote:   { from: ['pending_quote'], role: 'provider', to: 'quoted' },
  accept:  { from: ['quoted'], role: 'client', to: 'accepted' },
  pay:     { from: ['accepted'], role: 'client', to: 'paid' },
  start:   { from: ['paid'], role: 'provider', to: 'in_progress' },
  deliver: { from: ['in_progress'], role: 'provider', to: 'delivered' },
  approve: { from: ['delivered'], role: 'client', to: 'completed' },
  dispute: { from: ['pending_quote', 'quoted', 'accepted', 'paid', 'in_progress', 'delivered'], role: 'both', to: 'disputed' },
  cancel:  { from: ['pending_quote', 'quoted'], role: 'client', to: 'cancelled' },
};

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
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

    const order = await getServiceOrderById(params.id);
    if (!order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    if (order.client_agent_id !== agent.id && order.provider_agent_id !== agent.id) {
      return NextResponse.json(
        { success: false, error: 'You do not have access to this order' },
        { status: 403 }
      );
    }

    return NextResponse.json({ success: true, data: order });
  } catch (error) {
    console.error('Error fetching order:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch order' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
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

    const order = await getServiceOrderById(params.id);
    if (!order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    if (order.client_agent_id !== agent.id && order.provider_agent_id !== agent.id) {
      return NextResponse.json(
        { success: false, error: 'You do not have access to this order' },
        { status: 403 }
      );
    }

    const body = await request.json();

    if (!body.action || typeof body.action !== 'string') {
      return NextResponse.json(
        { success: false, error: 'action is required' },
        { status: 400 }
      );
    }

    const transition = VALID_TRANSITIONS[body.action];
    if (!transition) {
      return NextResponse.json(
        { success: false, error: `Invalid action: ${body.action}. Valid actions: ${Object.keys(VALID_TRANSITIONS).join(', ')}` },
        { status: 400 }
      );
    }

    const isClient = order.client_agent_id === agent.id;
    const isProvider = order.provider_agent_id === agent.id;

    if (transition.role === 'client' && !isClient) {
      return NextResponse.json(
        { success: false, error: `Only the client can perform the "${body.action}" action` },
        { status: 403 }
      );
    }

    if (transition.role === 'provider' && !isProvider) {
      return NextResponse.json(
        { success: false, error: `Only the provider can perform the "${body.action}" action` },
        { status: 403 }
      );
    }

    if (!transition.from.includes(order.status)) {
      return NextResponse.json(
        { success: false, error: `Cannot "${body.action}" an order with status "${order.status}". Allowed from: ${transition.from.join(', ')}` },
        { status: 400 }
      );
    }

    const updates: {
      status: OrderStatus;
      quoted_price_usd?: string;
      payment_method?: string;
      escrow_tx_hash?: string;
      deliverable_post_id?: number;
      deliverable_url?: string;
      deliverable_media_type?: string;
    } = { status: transition.to };

    if (body.action === 'quote') {
      if (!body.quoted_price_usd || typeof body.quoted_price_usd !== 'string') {
        return NextResponse.json(
          { success: false, error: 'quoted_price_usd is required for the "quote" action' },
          { status: 400 }
        );
      }
      const price = parseFloat(body.quoted_price_usd);
      if (isNaN(price) || price <= 0) {
        return NextResponse.json(
          { success: false, error: 'quoted_price_usd must be a positive number' },
          { status: 400 }
        );
      }
      updates.quoted_price_usd = body.quoted_price_usd;
    }

    if (body.action === 'pay') {
      if (!body.payment_method || typeof body.payment_method !== 'string') {
        return NextResponse.json(
          { success: false, error: 'payment_method is required for the "pay" action' },
          { status: 400 }
        );
      }
      if (!body.escrow_tx_hash || typeof body.escrow_tx_hash !== 'string') {
        return NextResponse.json(
          { success: false, error: 'escrow_tx_hash is required for the "pay" action' },
          { status: 400 }
        );
      }
      updates.payment_method = body.payment_method;
      updates.escrow_tx_hash = body.escrow_tx_hash;
    }

    if (body.action === 'deliver') {
      if (body.deliverable_url && typeof body.deliverable_url === 'string') {
        updates.deliverable_url = body.deliverable_url;
        if (body.deliverable_media_type && typeof body.deliverable_media_type === 'string') {
          updates.deliverable_media_type = body.deliverable_media_type;
        }
      } else if (body.deliverable_post_id !== undefined && typeof body.deliverable_post_id === 'number') {
        updates.deliverable_post_id = body.deliverable_post_id;
      } else {
        return NextResponse.json(
          { success: false, error: 'deliver requires either deliverable_url (string) or deliverable_post_id (number)' },
          { status: 400 }
        );
      }
    }

    const updated = await updateOrderStatus(params.id, updates);

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error updating order:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update order' },
      { status: 500 }
    );
  }
}
