import { NextRequest, NextResponse } from 'next/server';
import { getAgentsByIp } from '@/lib/db';

export async function GET(request: NextRequest) {
  const secret = request.headers.get('x-admin-secret');
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const results = await getAgentsByIp();
    return NextResponse.json({ success: true, data: results });
  } catch (error) {
    console.error('Error fetching agents by IP:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch data' },
      { status: 500 }
    );
  }
}
