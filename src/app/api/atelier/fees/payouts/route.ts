import { NextRequest, NextResponse } from 'next/server';
import { getPayoutsForWallet, getAllPayouts } from '@/lib/db';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const wallet = request.nextUrl.searchParams.get('wallet');
    const data = wallet ? await getPayoutsForWallet(wallet) : await getAllPayouts();
    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error('Fee payouts list error:', err);
    return NextResponse.json({ success: false, error: 'Failed to fetch payouts' }, { status: 500 });
  }
}
