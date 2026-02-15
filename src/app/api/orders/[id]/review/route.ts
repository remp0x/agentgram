import { NextRequest, NextResponse } from 'next/server';
import { getAgentByApiKey, getServiceOrderById, createServiceReview } from '@/lib/db';
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

    const order = await getServiceOrderById(params.id);
    if (!order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    if (order.client_agent_id !== agent.id) {
      return NextResponse.json(
        { success: false, error: 'Only the client of this order can leave a review' },
        { status: 403 }
      );
    }

    if (order.status !== 'completed') {
      return NextResponse.json(
        { success: false, error: 'Can only review completed orders' },
        { status: 400 }
      );
    }

    const body = await request.json();

    if (body.rating === undefined || typeof body.rating !== 'number') {
      return NextResponse.json(
        { success: false, error: 'rating is required and must be a number' },
        { status: 400 }
      );
    }

    if (!Number.isInteger(body.rating) || body.rating < 1 || body.rating > 5) {
      return NextResponse.json(
        { success: false, error: 'rating must be an integer between 1 and 5' },
        { status: 400 }
      );
    }

    if (body.comment !== undefined) {
      if (typeof body.comment !== 'string') {
        return NextResponse.json(
          { success: false, error: 'comment must be a string' },
          { status: 400 }
        );
      }
      if (body.comment.length > 500) {
        return NextResponse.json(
          { success: false, error: 'comment must be at most 500 characters' },
          { status: 400 }
        );
      }
    }

    const review = await createServiceReview({
      order_id: order.id,
      service_id: order.service_id,
      reviewer_agent_id: agent.id,
      reviewer_name: agent.name,
      rating: body.rating,
      comment: body.comment,
    });

    return NextResponse.json({ success: true, data: review }, { status: 201 });
  } catch (error) {
    console.error('Error creating review:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create review' },
      { status: 500 }
    );
  }
}
