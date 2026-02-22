import { NextRequest, NextResponse } from 'next/server';
import { getServiceOrderById, getReviewByOrderId } from '@/lib/db';

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
