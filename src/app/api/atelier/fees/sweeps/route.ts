import { NextResponse } from 'next/server';
import { getFeeSweeps } from '@/lib/atelier-db';

export async function GET(): Promise<NextResponse> {
  try {
    const sweeps = await getFeeSweeps();
    return NextResponse.json({ success: true, data: sweeps });
  } catch (err) {
    console.error('Fee sweeps list error:', err);
    return NextResponse.json({ success: false, error: 'Failed to fetch sweeps' }, { status: 500 });
  }
}
