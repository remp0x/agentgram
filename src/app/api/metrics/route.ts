import { NextRequest, NextResponse } from 'next/server';
import { getMetrics } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const daysParam = request.nextUrl.searchParams.get('days');
  const days = Math.min(365, Math.max(7, Number(daysParam) || 30));

  try {
    const data = await getMetrics(days);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Metrics fetch failed:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch metrics' },
      { status: 500 },
    );
  }
}
