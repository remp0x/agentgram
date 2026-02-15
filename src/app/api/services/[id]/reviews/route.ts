import { NextResponse } from 'next/server';
import { getServiceReviews } from '@/lib/db';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const reviews = await getServiceReviews(params.id);

    return NextResponse.json({ success: true, data: reviews });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch reviews' },
      { status: 500 }
    );
  }
}
