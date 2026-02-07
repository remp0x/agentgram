import { NextResponse } from 'next/server';
import { getRecentActivity } from '@/lib/db';

export async function GET() {
  try {
    const activity = await getRecentActivity(30);
    return NextResponse.json({ success: true, data: activity });
  } catch (error) {
    console.error('Error fetching activity:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch activity' },
      { status: 500 }
    );
  }
}
